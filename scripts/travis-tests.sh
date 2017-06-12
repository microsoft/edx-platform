#!/usr/bin/env bash

set -e

# Return status is that of the last command to fail in a
# piped command, or a zero if they all succeed.
set -o pipefail

# There is no need to install the prereqs, as this was already
# just done via the dependencies override section of circle.yml.
export NO_PREREQ_INSTALL='true'

PAVER_ARGS="--with-flaky --processes=-1 --cov-args='-p' --with-xunitmp"

# Violations thresholds for failing the build
export PYLINT_THRESHOLD=3600
export ESLINT_THRESHOLD=10122

SAFELINT_THRESHOLDS=`cat scripts/safelint_thresholds.json`
export SAFELINT_THRESHOLDS=${SAFELINT_THRESHOLDS//[[:space:]]/}

EXIT=0

# Clean up previous builds
git clean -qxfd

function emptyxunit {

    cat > reports/$1.xml <<END
<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="$1" tests="1" errors="0" failures="0" skip="0">
<testcase classname="$1" name="$1" time="0.604"></testcase>
</testsuite>
END

}

case "$TEST_SUITE" in

    "quality")
        echo "Finding fixme's and storing report..."
        paver find_fixme > fixme.log || { cat fixme.log; EXIT=1; }
        echo "Finding pep8 violations and storing report..."
        paver run_pep8 > pep8.log || { cat pep8.log; EXIT=1; }
        echo "Finding pylint violations and storing in report..."
        paver run_pylint -l $PYLINT_THRESHOLD > pylint.log || { cat pylint.log; EXIT=1; }

        mkdir -p reports

        echo "Finding ESLint violations and storing report..."
        paver run_eslint -l $ESLINT_THRESHOLD > eslint.log || { cat eslint.log; EXIT=1; }
        echo "Running code complexity report (python)."
        paver run_complexity || echo "Unable to calculate code complexity. Ignoring error."
        echo "Running safe template linter report."
        paver run_safelint -t $SAFELINT_THRESHOLDS > safelint.log || { cat safelint.log; EXIT=1; }
        echo "Running safe commit linter report."
        paver run_safecommit_report > safecommit.log || { cat safecommit.log; EXIT=1; }
        # Run quality task. Pass in the 'fail-under' percentage to diff-quality
        echo "Running diff quality."
        paver run_quality -p 100 || EXIT=1

        # Need to create an empty test result so the post-build
        # action doesn't fail the build.
        emptyxunit "quality"
        exit $EXIT
        ;;

    "lms-unit")
        paver test_system -s lms $PAVER_ARGS        
        ;;

    "cms-unit")
        paver test_system -s cms $PAVER_ARGS
        ;;

    "lib")
        paver test_lib --with-flaky --cov-args="-p" -v --with-xunit
        ;;

esac
