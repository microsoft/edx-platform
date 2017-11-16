"""
Tests for v1 views
"""
from contextlib import contextmanager
from datetime import datetime
import ddt
from django.core.urlresolvers import reverse
from django.test.utils import override_settings
from mock import MagicMock, patch
from opaque_keys import InvalidKeyError
from pytz import UTC
from rest_framework import status
from rest_framework.test import APITestCase

from capa.tests.response_xml_factory import MultipleChoiceResponseXMLFactory
from edx_oauth2_provider.tests.factories import AccessTokenFactory, ClientFactory
from lms.djangoapps.courseware.tests.factories import GlobalStaffFactory, StaffFactory
from lms.djangoapps.grades.tests.utils import mock_passing_grade
from student.tests.factories import CourseEnrollmentFactory, UserFactory
from xmodule.modulestore import ModuleStoreEnum
from xmodule.modulestore.tests.factories import CourseFactory, ItemFactory
from xmodule.modulestore.tests.django_utils import SharedModuleStoreTestCase, TEST_DATA_SPLIT_MODULESTORE


class GradeViewTestMixin(SharedModuleStoreTestCase):
    """
    Mixin class for grades related view tests

    The following tests assume that the grading policy is the edX default one:
    {
        "GRADER": [
            {
                "drop_count": 2,
                "min_count": 12,
                "short_label": "HW",
                "type": "Homework",
                "weight": 0.15
            },
            {
                "drop_count": 2,
                "min_count": 12,
                "type": "Lab",
                "weight": 0.15
            },
            {
                "drop_count": 0,
                "min_count": 1,
                "short_label": "Midterm",
                "type": "Midterm Exam",
                "weight": 0.3
            },
            {
                "drop_count": 0,
                "min_count": 1,
                "short_label": "Final",
                "type": "Final Exam",
                "weight": 0.4
            }
        ],
        "GRADE_CUTOFFS": {
            "Pass": 0.5
        }
    }
    """
    MODULESTORE = TEST_DATA_SPLIT_MODULESTORE

    @classmethod
    def setUpClass(cls):
        super(GradeViewTestMixin, cls).setUpClass()

        cls.courses = []

        for i in xrange(3):
            name = 'test_course ' + str(i)
            run = 'Testing_Course_' + str(i)
            course = cls._create_test_course_with_default_grading_policy(name, run)
            cls.courses.append(course)

        cls.course_keys = [course.id for course in cls.courses]

        cls.password = 'test'
        cls.student = UserFactory(username='dummy', password=cls.password)
        cls.other_student = UserFactory(username='foo', password=cls.password)
        cls.other_user = UserFactory(username='bar', password=cls.password)
        cls.staff = StaffFactory(course_key=cls.course_keys[0], password=cls.password)
        cls.global_staff = GlobalStaffFactory.create()
        cls.admin = UserFactory(username='admin', password=cls.password, is_superuser=True)
        date = datetime(2017, 11, 10, tzinfo=UTC)
        for user in (cls.student, cls.other_student, ):
            for course_key in cls.course_keys:
                CourseEnrollmentFactory(
                    course_id=course_key,
                    user=user,
                    created=date,
                )

    def setUp(self):
        super(GradeViewTestMixin, self).setUp()
        self.client.login(username=self.student.username, password=self.password)

    @classmethod
    def _create_test_course_with_default_grading_policy(cls, display_name, run):
        course = CourseFactory.create(display_name=display_name, run=run)

        chapter = ItemFactory.create(
            category='chapter',
            parent_location=course.location,
            display_name="Chapter 1",
        )
        # create a problem for each type and minimum count needed by the grading policy
        # A section is not considered if the student answers less than "min_count" problems
        for grading_type, min_count in (("Homework", 12), ("Lab", 12), ("Midterm Exam", 1), ("Final Exam", 1)):
            for num in xrange(min_count):
                section = ItemFactory.create(
                    category='sequential',
                    parent_location=chapter.location,
                    due=datetime(2017, 12, 18, 11, 30, 00),
                    display_name='Sequential {} {}'.format(grading_type, num),
                    format=grading_type,
                    graded=True,
                )
                vertical = ItemFactory.create(
                    category='vertical',
                    parent_location=section.location,
                    display_name='Vertical {} {}'.format(grading_type, num),
                )
                ItemFactory.create(
                    category='problem',
                    parent_location=vertical.location,
                    display_name='Problem {} {}'.format(grading_type, num),
                )

        return course

    def get_url(self):
        raise NotImplemented

    def _test_anonymous(self):
        """
        Test that an anonymous user cannot access the API and an error is received.
        """
        self.client.logout()
        resp = self.client.get(self.get_url(self.student.username))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def _test_self_get_grade(self):
        """
        Test that a user can successfully request her own grade.
        """
        resp = self.client.get(self.get_url(self.student.username))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def _test_nonexistent_user(self):
        """
        Test that a request for a nonexistent username returns an error.
        """
        self.client.logout()
        self.client.login(username=self.staff.username, password=self.password)
        resp = self.client.get(self.get_url('IDoNotExist'))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('error_code', resp.data)  # pylint: disable=no-member
        self.assertEqual(resp.data['error_code'], 'user_does_not_exist')  # pylint: disable=no-member

    def _test_other_get_grade(self):
        """
        Test that if a user requests the grade for another user, she receives an error.
        """
        self.client.logout()
        self.client.login(username=self.other_student.username, password=self.password)
        resp = self.client.get(self.get_url(self.student.username))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('error_code', resp.data)  # pylint: disable=no-member
        self.assertEqual(resp.data['error_code'], 'user_mismatch')  # pylint: disable=no-member


@ddt.ddt
class CourseGradeViewTest(GradeViewTestMixin, APITestCase):
    """
    Tests for grades related to a course
        i.e. /api/grades/v1/course_grade/{course_id}/users/{username}=(student|all)
    """

    @classmethod
    def setUpClass(cls):
        super(CourseGradeViewTest, cls).setUpClass()
        cls.namespaced_url = 'grades_api:v1:course_grades'

    def setUp(self):
        super(CourseGradeViewTest, self).setUp()

    def get_url(self, username):
        """
        Helper function to create the url
        """
        base_url = reverse(
            self.namespaced_url,
            kwargs={
                'course_id': self.course_keys[0],
            }
        )
        return "{0}?username={1}".format(base_url, username)

    def test_anonymous(self):
        super(CourseGradeViewTest, self)._test_anonymous()

    def test_self_get_grade(self):
        super(CourseGradeViewTest, self)._test_self_get_grade()

    def test_nonexistent_user(self):
        super(CourseGradeViewTest, self)._test_nonexistent_user()

    def test_other_get_grade(self):
        super(CourseGradeViewTest, self)._test_other_get_grade()

    def _test_self_get_grade_not_enrolled(self):
        """
        Test that a user receives an error if she requests
        her own grade in a course where she is not enrolled.
        """
        # a user not enrolled in the course cannot request her grade
        self.client.logout()
        self.client.login(username=self.other_user.username, password=self.password)
        resp = self.client.get(self.get_url(self.other_user.username))
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('error_code', resp.data)  # pylint: disable=no-member
        self.assertEqual(
            resp.data['error_code'],  # pylint: disable=no-member
            'user_or_course_does_not_exist'
        )

    def _test_no_grade(self):
        """
        Test the grade for a user who has not answered any test.
        """
        resp = self.client.get(self.get_url(self.student.username))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        expected_data = [{
            'user': self.student.username,
            'course_key': str(self.course_keys[0]),
            'passed': False,
            'percent': 0.0,
            'letter_grade': None
        }]

        self.assertEqual(resp.data, expected_data)  # pylint: disable=no-member

    def test_wrong_course_key(self):
        """
        Test that a request for an invalid course key returns an error.
        """
        def mock_from_string(*args, **kwargs):  # pylint: disable=unused-argument
            """Mocked function to always raise an exception"""
            raise InvalidKeyError('foo', 'bar')

        with patch('opaque_keys.edx.keys.CourseKey.from_string', side_effect=mock_from_string):
            resp = self.client.get(self.get_url(self.student.username))

        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('error_code', resp.data)  # pylint: disable=no-member
        self.assertEqual(
            resp.data['error_code'],  # pylint: disable=no-member
            'invalid_course_key'
        )

    def test_course_does_not_exist(self):
        """
        Test that requesting a valid, nonexistent course key returns an error as expected.
        """
        base_url = reverse(
            self.namespaced_url,
            kwargs={
                'course_id': 'course-v1:MITx+8.MechCX+2014_T1',
            }
        )
        url = "{0}?username={1}".format(base_url, self.student.username)
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('error_code', resp.data)  # pylint: disable=no-member
        self.assertEqual(
            resp.data['error_code'],  # pylint: disable=no-member
            'user_or_course_does_not_exist'
        )

    @ddt.data(
        ({'letter_grade': None, 'percent': 0.4, 'passed': False}),
        ({'letter_grade': 'Pass', 'percent': 1, 'passed': True}),
    )
    def test_grade(self, grade):
        """
        Test that the user gets her grade in case she answered tests with an insufficient score.
        """
        with patch('lms.djangoapps.grades.new.course_grade.CourseGradeFactory.get_persisted') as mock_grade:
            grade_fields = {
                'letter_grade': grade['letter_grade'],
                'percent': grade['percent'],
                'passed': grade['letter_grade'] is not None,

            }
            mock_grade.return_value = MagicMock(**grade_fields)
            resp = self.client.get(self.get_url(self.student.username))

        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        expected_data = {
            'user': unicode(self.student.username),
            'course_key': str(self.course_keys[0]),
        }

        expected_data.update(grade)
        self.assertEqual(resp.data, [expected_data])  # pylint: disable=no-member

    @ddt.data(
        'staff', 'global_staff'
    )
    def test_staff_can_see_student(self, staff_user):
        """
        Ensure that staff members can see her student's grades.
        """
        self.client.logout()
        self.client.login(username=getattr(self, staff_user).username, password=self.password)
        resp = self.client.get(self.get_url(self.student.username))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        expected_data = [{
            'user': self.student.username,
            'letter_grade': None,
            'percent': 0.0,
            'course_key': str(self.course_keys[0]),
            'passed': False
        }]
        self.assertEqual(resp.data, expected_data)  # pylint: disable=no-member

    def test_username_all_as_student(self):
        """
        Test requesting with username == 'all' and no staff access
        returns 403 forbidden
        """
        resp = self.client.get(self.get_url('all'))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('error_code', resp.data)  # pylint: disable=no-member
        self.assertEqual(resp.data['error_code'], 'user_mismatch')  # pylint: disable=no-member

    @ddt.data('staff', 'global_staff')
    def test_username_all_as_staff(self, staff_user):
        """
        Test requesting with username == 'all' and staff access
        returns all user grades for course
        """
        self.client.logout()
        self.client.login(username=getattr(self, staff_user).username, password=self.password)
        resp = self.client.get(self.get_url('all'))

        self.assertEqual(resp.status_code, status.HTTP_200_OK)


@ddt.ddt
class UserGradesViewTest(GradeViewTestMixin, APITestCase):
    """
    Tests for grades related to a user
        i.e. /api/grades/v1/user_grades/{username}=(student|all)
    """

    @classmethod
    def setUpClass(cls):
        super(UserGradesViewTest, cls).setUpClass()
        cls.namespaced_url = 'grades_api:v1:user_grades'

    def setUp(self):
        super(UserGradesViewTest, self).setUp()

    def get_url(self, username):
        """
        Helper function to create the url
        """
        base_url = reverse(self.namespaced_url)
        return "{0}?username={1}".format(base_url, username)

    def test_anonymous(self):
        super(UserGradesViewTest, self)._test_anonymous()

    def test_self_get_grade(self):
        super(UserGradesViewTest, self)._test_self_get_grade()

    def test_nonexistent_user(self):
        super(UserGradesViewTest, self)._test_nonexistent_user()

    def test_other_get_grade(self):
        super(UserGradesViewTest, self)._test_other_get_grade()

    def test_no_enrollments(self):
        """
        Test a user with no course enrollment sees an empty response
        """
        self.client.logout()
        self.client.login(username=self.other_user.username, password=self.password)
        resp = self.client.get(self.get_url(self.other_user.username))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data, [])

    @ddt.data('student', 'other_user', 'staff', 'global_staff', 'admin')
    def test_username_all_not_accessible_to_users_and_staff(self, staff_user):
        """
        Test a user receives a 403 forbidden error when trying
        to access bulk grades
        """
        self.client.logout()
        self.client.login(username=getattr(self, staff_user).username, password=self.password)
        resp = self.client.get(self.get_url('all'))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('error_code', resp.data)  # pylint: disable=no-member
        self.assertEqual(resp.data['error_code'], 'user_does_not_have_access')  # pylint: disable=no-member

    @override_settings(BULK_GRADES_API_ADMIN_USERNAME='admin')
    def test_username_all_accessible_to_bulk_grades_admin(self):
        """
        Test username == 'all' is only accessible if a
        user is superuser and username == BULK_GRADES_API_ADMIN_USERNAME
        in settings
        """
        self.client.logout()
        self.client.login(username=self.admin.username, password=self.password)
        resp = self.client.get(self.get_url('all'))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('pagination', resp.data)  # pylint: disable=no-member
        self.assertIn('results', resp.data)  # pylint: disable=no-member
