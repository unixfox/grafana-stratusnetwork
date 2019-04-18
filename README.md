![GitHub stars](https://img.shields.io/github/stars/unixfox/grafana-stratusnetwork.svg?style=social) [![Docker Cloud Build Status](https://img.shields.io/docker/cloud/build/unixfox/grafana-stratusnetwork.svg)](https://hub.docker.com/r/unixfox/grafana-stratusnetwork) [![Docker Cloud Automated build](https://img.shields.io/docker/cloud/automated/unixfox/grafana-stratusnetwork.svg)](https://hub.docker.com/r/unixfox/grafana-stratusnetwork) ![GitHub package.json version](https://img.shields.io/github/package-json/v/unixfox/grafana-stratusnetwork.svg)
# Description
Scripts and programs for generating the grafana dashboard for the Minecraft server Stratus Network

# Technologies used
- [Grafana](https://grafana.com), a platform for analytics and monitoring
- [InfluxDB](https://github.com/influxdata/influxdb), a time series database
- [MySQL](https://www.mysql.com), a relational SQL database

# Details of each programs and scripts
- `bot.js`: A minecraft bot used for retrieving the current [rotation](https://stratus.network/forums/topics/5b53e7d83a4d330001001354) of the server because there is no way to get this information on the website
- `currentmap.sh`: A bash script used to update the informations from the website about the current map and the recents matches played on the mixed server
- `export.sql`: An export of the table `stratusgraph` of the MySQL database
- `minecraft-current-players.pl`: A perl script used for retrieving the current players online on the server
- `predict.py`: A python program used to predict who will win on the mixed. Author Siceth, his repository https://github.com/Siceth/Stratus-Stat-Utilities
- `stratus_image_map.php`: A PHP program used for retrieving the image of the current map played on the server
- `update_rot.sh`: A bash script used for retrieving the rotation name given by `bot.js` and then getting the maps from [the rotation repository](https://github.com/StratusNetwork/data/tree/master/rotations)
