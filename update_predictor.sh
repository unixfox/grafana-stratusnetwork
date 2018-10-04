#!/bin/bash
wget -q -N https://raw.githubusercontent.com/Siceth/Stratus-Stat-Utilities/master/Stratus%20Stat%20Utilities.py
sed -i 's/HEADLESS_MODE = False/HEADLESS_MODE = True/g' "Stratus Stat Utilities.py"
sed -i 's/REALTIME_MODE = False/REALTIME_MODE = True/g' "Stratus Stat Utilities.py"