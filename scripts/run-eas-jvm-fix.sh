#!/bin/bash
# Clear any extra arguments to prevent EAS from passing "--platform" to the script
set --
node ./scripts/eas-jvm-fix.js
