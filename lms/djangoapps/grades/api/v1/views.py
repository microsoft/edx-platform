""" API v1 views. """
import logging
from datetime import datetime

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import Http404
from opaque_keys import InvalidKeyError
from opaque_keys.edx.keys import CourseKey
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.generics import GenericAPIView, ListAPIView
from rest_framework.response import Response

from courseware.access import has_access
from lms.djangoapps.ccx.utils import prep_course_for_grading
from lms.djangoapps.courseware import courses
from lms.djangoapps.courseware.exceptions import CourseAccessRedirect
from lms.djangoapps.grades.api.serializers import GradingPolicySerializer
from lms.djangoapps.grades.new.course_grade import CourseGrade, CourseGradeFactory
from openedx.core.djangoapps.site_configuration import helpers as configuration_helpers
from openedx.core.lib.api.paginators import NamespacedPageNumberPagination
from openedx.core.lib.api.view_utils import DeveloperErrorViewMixin, view_auth_classes
from enrollment import data as enrollment_data
from student.roles import CourseStaffRole

log = logging.getLogger(__name__)
USER_MODEL = get_user_model()


@view_auth_classes()
class GradeViewMixin(DeveloperErrorViewMixin):
    """
    Mixin class for Grades related views.
    """

    pagination_class = NamespacedPageNumberPagination

    def _get_course(self, course_key_string, user, access_action):
        """
        Returns the course for the given course_key_string after
        verifying the requested access to the course by the given user.
        """
        try:
            course_key = CourseKey.from_string(course_key_string)
        except InvalidKeyError:
            return self.make_error_response(
                status_code=status.HTTP_404_NOT_FOUND,
                developer_message='The provided course key cannot be parsed.',
                error_code='invalid_course_key'
            )

        try:
            course_org_filter = configuration_helpers.get_current_site_orgs()
            if course_org_filter and course_key.org not in course_org_filter:
                raise Http404
            return courses.get_course_with_access(
                user,
                access_action,
                course_key,
                check_if_enrolled=True,
            )
        except Http404:
            log.info('Course with ID "%s" not found', course_key_string)
        except CourseAccessRedirect:
            log.info('User %s does not have access to course with ID "%s"', user.username, course_key_string)
        return self.make_error_response(
            status_code=status.HTTP_404_NOT_FOUND,
            developer_message='The user, the course or both do not exist.',
            error_code='user_or_course_does_not_exist',
        )

    def _get_courses(self, user, access_action):
        """
        Get a users course enrollments based on the access_action
        and if the user has that access level and return the
        associated courses.
        """
        enrollments = enrollment_data.get_course_enrollments(user.username)
        course_key_strings = [enrollment.get('course_details').get('course_id') for enrollment in enrollments]

        courses = []
        for course_key_string in course_key_strings:
            course = self._get_course(course_key_string, user, access_action)
            if not isinstance(course, Response):
                courses.append(course)

        return courses

    def _get_effective_user(self, request, courses):
        """
        Returns the user object corresponding to the request's 'username' parameter,
        or the current request.user if no 'username' was provided.

        Verifies that the request.user has access to the requested users's grades.
        Returns a 403 error response if access is denied, or a 404 error response if the user does not exist.
        """

        # Use the request user's if none provided.
        if 'username' in request.GET:
            username = request.GET.get('username')
        else:
            username = request.user.username

        if request.user.username == username:
            # Any user may request her own grades
            return request.user

        # Only a user with staff access may request grades for a user other than herself.
        for course in courses:
            if not has_access(request.user, CourseStaffRole.ROLE, course):
                log.info(
                    'User %s tried to access the grade for user %s.',
                    request.user.username,
                    username
                )
                return self.make_error_response(
                    status_code=status.HTTP_403_FORBIDDEN,
                    developer_message='The user requested does not match the logged in user.',
                    error_code='user_mismatch'
                )

        if username == 'all':
            try:
                course = courses[0]
                return [enrollment.user for enrollment in enrollment_data.get_user_enrollments(course.id, serialize=False)]
            except:
                return self.make_error_response(
                    status_code=status.HTTP_404_NOT_FOUND,
                    developer_message='The course does not have any enrollments.',
                    error_code='no_course_enrollments'
                )

        try:
            return USER_MODEL.objects.get(username=username)

        except USER_MODEL.DoesNotExist:
            return self.make_error_response(
                status_code=status.HTTP_404_NOT_FOUND,
                developer_message='The user matching the requested username does not exist.',
                error_code='user_does_not_exist'
            )

    def _read_or_create_grade(self, user, course, calculate=None, use_email=None):
        """
        Read or create a new CourseGrade for the specified user and course.
        """
        if calculate is not None:
            course_grade = CourseGradeFactory().create(user, course, read_only=False)
        else:
            course_grade = CourseGradeFactory().get_persisted(user, course)

        # Handle the case of a course grade not existing,
        # return a Zero course grade
        if not course_grade:
            course_grade = CourseGrade(user, course, None)
            course_grade._percent = 0.0
            course_grade._letter_grade = None
            course_grade._passed = False

        if use_email is not None:
            user = user.email
        else:
            user = user.username

        return {
            'user': user,
            'course_key': str(course.id),
            'passed': course_grade.passed,
            'percent': course_grade.percent,
            'letter_grade': course_grade.letter_grade,
        }

    def _parse_filter_date_string(self, date_string):
        """
        Parse an ISO 8061 date string from url parameter
        """
        if not date_string:
            return
        if len(date_string) == 10:
            # e.g. 2017-01-31
            date_string += "T00:00:00"
        try:
            return datetime.strptime(date_string, "%Y-%m-%dT%H:%M:%S")
        except Exception as exc:
            log.exception('Error parsing provided date string', date_string, exc.message)
            return self.make_error_response(
                status_code=status.HTTP_400_BAD_REQUEST,
                developer_message='Could not parse date one of the provided date filters',
                error_code='date_filter_format'
            )

    def perform_authentication(self, request):
        """
        Ensures that the user is authenticated (e.g. not an AnonymousUser), unless DEBUG mode is enabled.
        """
        super(GradeViewMixin, self).perform_authentication(request)
        if request.user.is_anonymous():
            raise AuthenticationFailed


class CourseGradeView(GradeViewMixin, GenericAPIView):
    """
    **Use Case**

        * Get the current course grades for a user in a course.

        The currently logged-in user may request her own grades, or a user with staff access to the course may request
        any/all enrolled user's grades.

    **Example Request**

        GET /api/grades/v1/course_grade/{course_id}/users/?username={username}
        GET /api/grades/v1/course_grade/{course_id}/users/?username=all         - Get grades for all users in course

    **GET Parameters**

        A GET request may include the following parameters.

        * course_id: (required) A string representation of a Course ID.
        * username: (optional) A string representation of a user's username.
          Defaults to the currently logged-in user's username.
          if username is 'all', get grades for all enrolled users

    **GET Response Values**

        If the request for information about the course grade
        is successful, an HTTP 200 "OK" response is returned.

        The HTTP 200 response has the following values.

        * username: A string representation of a user's username passed in the request.

        * course_id: A string representation of a Course ID.

        * passed: Boolean representing whether the course has been
                  passed according the course's grading policy.

        * percent: A float representing the overall grade for the course

        * letter_grade: A letter grade as defined in grading_policy (e.g. 'A' 'B' 'C' for 6.002x) or None


    **Example GET Response**

        [{
            "username": "bob",
            "course_key": "course-v1:edX+DemoX+Demo_Course",
            "passed": false,
            "percent": 0.03,
            "letter_grade": None,
        }]

    **Example GET Response if username == 'all'**

        [{
            "username": "bob",
            "course_key": "course-v1:edX+DemoX+Demo_Course",
            "passed": false,
            "percent": 0.03,
            "letter_grade": null,
        },
        {
            "username": "fred",
            "course_key": "course-v1:edX+DemoX+Demo_Course",
            "passed": true,
            "percent": 0.83,
            "letter_grade": "B",
        },
        {
            "username": "kate",
            "course_key": "course-v1:edX+DemoX+Demo_Course",
            "passed": false,
            "percent": 0.19,
            "letter_grade": null,
        }]

    """

    def get(self, request, course_id):
        """
        Gets a course progress status.

        Args:
            request (Request): Django request object.
            course_id (string): URI element specifying the course location.

        Return:
            A JSON serialized representation of the requesting user's current grade status.
        """

        should_calculate_grade = request.GET.get('calculate')
        use_email = request.GET.get('use_email', None)
        course = self._get_course(course_id, request.user, 'load')

        if isinstance(course, Response):
            # Returns a 404 if course_id is invalid, or request.user is not enrolled in the course
            return course

        grade_user = self._get_effective_user(request, [course])
        prep_course_for_grading(course, request)

        if isinstance(grade_user, Response):
            # Returns a 403 if the request.user can't access grades for the requested user,
            # or a 404 if the requested user does not exist or the course had no enrollments.
            return grade_user

        elif isinstance(grade_user, list):
            # List of grades for all users in course
            if len(grade_user) > 40:
                log.warning('Cannot calculate real-time bulk grades...reading from persisted grades')
                should_calculate_grade = None

            response = list()
            for user in grade_user:
                course_grade = self._read_or_create_grade(user, course, should_calculate_grade, use_email)
                response.append(course_grade)
        else:
            # Grade for one user in course
            course_grade = self._read_or_create_grade(grade_user, course, should_calculate_grade, use_email)
            response = [course_grade]

        return Response(response)


class UserGradeView(GradeViewMixin, GenericAPIView):
    """
    **Use Case**

        * Get the current course grades for a user in all courses

        The currently logged-in user may request her own grades, or a user with staff access to the course may request
        any enrolled user's grades.

    **Example Request**

        GET /api/grades/v1/user_grades/?username={username}
        GET /api/grades/v1/user_grades/?username=all

    **GET Parameters**

        A GET request may include the following parameters.

        * username: (optional) A string representation of a user's username.
          Defaults to the currently logged-in user's username.
          If 'all' return all grades from PersistentGrades table

        * calculate: (optional) Boolean value, if set calculate grades for user
          in real time if username is not 'all'

        **Only function if username is 'all'**
        * start_date: (optional) An ISO string representation of a start date
          to filter the modified datetime on in the PersistentGrades table
        * end_date: (optional) An ISO string representation of a end date
          to filter the modified datetime on in the PersistentGrades table

    **GET Response Values**

        If the request for information about the course grade
        is successful, an HTTP 200 "OK" response is returned.

        The HTTP 200 response has the following values.

        * username: A string representation of a user's username passed in the request.

        * course_id: A string representation of a Course ID.

        * passed: Boolean representing whether the course has been
                  passed according the course's grading policy.

        * percent: A float representing the overall grade for the course

        * letter_grade: A letter grade as defined in grading_policy (e.g. 'A' 'B' 'C' for 6.002x) or None


    **Example GET Response**

        [{
            "username": "bob",
            "course_key": "course-v1:edX+DemoX+Demo_Course",
            "passed": false,
            "percent": 0.03,
            "letter_grade": None,
        },
        {
            "username": "bob",
            "course_key": "course-v1:edX+DemoX+A_Different_Course",
            "passed": true,
            "percent": 0.93,
            "letter_grade": "A",
        }]
    """

    def get(self, request):
        """
        Gets a user's grades in all enrolled courses
        or returns bulk grades from PersistentGrades table if specified
        username is 'all'

        Args:
            request (Request): Django request object.

        Return:
            A JSON serialized representation of the requesting user's current grade status
            or if username is 'all' a response from the PersistentGrades table filtered by
            start_date and end_date
        """

        username = request.GET.get('username')
        should_calculate_grade = request.GET.get('calculate', None)
        use_email = request.GET.get('use_email', None)
        start_date_string = request.GET.get('start_date')
        end_date_string = request.GET.get('end_date')

        if username == 'all':
            # Essentially an export function of the PersistantGrades table.
            # Read all grades for all students, filter on start_date and end_date
            if should_calculate_grade:
                log.warning('Cannot calculate real-time bulk grades...reading from persisted grades')
                should_calculate_grade = None

            # This is very sensitive functionality and is locked down to a single
            # explicitly set user in the AUTH settings (lms.auth.json).
            # This user is also required to have superuser status
            bulk_grades_admin = settings.BULK_GRADES_API_ADMIN_USERNAME
            if not request.user.is_superuser or request.user.username != bulk_grades_admin:
                return self.make_error_response(
                    status_code=status.HTTP_403_FORBIDDEN,
                    developer_message='The requesting user does not have the required credentials',
                    error_code='user_does_not_have_access'
                )

            # Validate start and end date parameters
            start_date = self._parse_filter_date_string(start_date_string)
            end_date = self._parse_filter_date_string(end_date_string)
            if isinstance(start_date, Response):
                return start_date
            if isinstance(end_date, Response):
                return end_date

            persisted_grades = CourseGradeFactory().bulk_read(start_date=start_date, end_date=end_date)
            page = self.paginator.paginate_queryset(persisted_grades, self.request, view=self)
            grades_to_serialize = persisted_grades if not page else page

            response = []
            for persisted_grade in grades_to_serialize:
                user = USER_MODEL.objects.get(id=persisted_grade.user_id)
                response.append({
                    'username': user.email,
                    'course_key': str(persisted_grade.course_id),
                    'passed': persisted_grade.passed_timestamp is not None,
                    'percent': persisted_grade.percent_grade,
                    'letter_grade': persisted_grade.letter_grade,
                })
            if page is not None:
                return self.get_paginated_response(response)
        else:
            # If username is not all, get the effective user for this call
            # calculate all of their grades in all enrolled courses.

            # Circular logic is required here. We need to validate the user exists
            # here first and get that valid user. We can then fetch that user's
            # enrolled courses but then need to revalidate that the requesting user
            # has access to all of these courses.
            grade_user = self._get_effective_user(request, [])
            if isinstance(grade_user, Response):
                return grade_user

            courses = self._get_courses(grade_user, 'load')

            grade_user = self._get_effective_user(request, courses)
            if isinstance(grade_user, Response):
                return grade_user

            response = []
            for course in courses:
                grade_response = self._read_or_create_grade(grade_user, course, should_calculate_grade, use_email)
                response.append(grade_response)

        return Response(response)


class CourseGradingPolicy(GradeViewMixin, ListAPIView):
    """
    **Use Case**

        Get the course grading policy.

    **Example requests**:

        GET /api/grades/v0/policy/{course_id}/

    **Response Values**

        * assignment_type: The type of the assignment, as configured by course
          staff. For example, course staff might make the assignment types Homework,
          Quiz, and Exam.

        * count: The number of assignments of the type.

        * dropped: Number of assignments of the type that are dropped.

        * weight: The weight, or effect, of the assignment type on the learner's
          final grade.
    """

    allow_empty = False

    def get(self, request, course_id, **kwargs):
        course = self._get_course(course_id, request.user, 'staff')
        if isinstance(course, Response):
            return course
        return Response(GradingPolicySerializer(course.raw_grader, many=True).data)
