#!/bin/bash
while true
do
	get_current_rot=$(node bot.js us.stratus.network 25565 $mc_user $mc_passwd)
	if [[ $get_current_rot == "error" ]]; then
		echo error
        sleep 5m
        get_current_rot=$(node bot.js us.stratus.network 25565 $mc_user $mc_passwd)
    fi
	current_rot=$(echo $get_current_rot | sed 's/\x1b\[[0-9;]*m//g' | pcregrep -o1 "Current Rotation \((?<rot>[a-zA-Z]+)\)" | sed 's/.*/\l&/')
	if [[ -z $current_rot ]]; then
		echo null
		current_rot="default"
	fi
	path="data/rotations/beta"
	cd data
	git pull > /dev/null
	cd ..
	echo $current_rot
	mysql -u $mysql_user -p$mysql_passwd stratusgraph -e "TRUNCATE currentrot;"
	number_of_maps=$(cat $path/$current_rot.yml | yq -r '.maps | length')
	for (( i=0; i < $number_of_maps; i++ ))
	do
		map_name=$(cat $path/$current_rot.yml | yq -r '.maps['$i']')
		mysql -u $mysql_user -p$mysql_passwd stratusgraph -e "INSERT INTO currentrot (map_name) VALUES (\"$map_name\");"
	done
	sleep 1m
done
