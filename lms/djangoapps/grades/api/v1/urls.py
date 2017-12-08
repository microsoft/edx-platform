""" Grades API v1 URLs. """
from django.conf import settings
from django.conf.urls import patterns, url

from lms.djangoapps.grades.api.v1 import views
from lms.djangoapps.grades.api.views import CourseGradingPolicy

urlpatterns = patterns(
    '',
    url(
        r'^course_grade/{course_id}/users/$'.format(
            course_id=settings.COURSE_ID_PATTERN,
        ),
        views.CourseGradeView.as_view(), name='course_grades'
    ),
    url(
        r'^user_grades/$',
        views.UserGradeView.as_view(), name='user_grades'
    ),
    url(
        r'^courses/{course_id}/policy/$'.format(
            course_id=settings.COURSE_ID_PATTERN,
        ),
        CourseGradingPolicy.as_view(), name='course_grading_policy'
    ),
)
