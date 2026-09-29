exit(){ if [ "$#" -gt 0 ] && [ "$1" != "0" ]; then echo "PART1_PROBE_EXIT_NEUTRALIZED=$1"; return 0; fi; builtin exit "$@"; }
