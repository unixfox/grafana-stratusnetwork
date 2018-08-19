#!/bin/bash
while true
do
	info_bot=$(node bot.js us.stratus.network 25565 $mc_user $mc_passwd)
	if [[ $info_bot == "error" ]]; then
		echo error
        sleep 5m
        info_bot=$(node bot.js us.stratus.network 25565 $mc_user $mc_passwd)
    fi
	current_rot=$(echo $info_bot | sed 's/\x1b\[[0-9;]*m//g' | pcregrep -o1 "Current Rotation \((?<rot>[a-zA-Z]+)\)" | sed 's/.*/\l&/')
	timelimit=$(echo $info_bot | sed 's/\x1b\[[0-9;]*m//g' | pcregrep -o1 "The time limit is (?<timelimit>.+) with the result(.*?)")
	next_map=$(echo $info_bot | sed 's/\x1b\[[0;]*m/-/g' | sed 's/\x1b\[[0-9;]*m//g' | pcregrep -o1 "Next map: -(?<nxtmap>.+)- by(.*?)")
	if [[ -z $current_rot ]]; then
		echo null
		current_rot="default"
	fi
	if [[ -z $timelimit ]]; then
		timelimit="No time limit"
	fi
	mysql -u $mysql_user -p$mysql_passwd stratusgraph -e "UPDATE currentmap SET Value = '$timelimit' WHERE id='4';"
	mysql -u $mysql_user -p$mysql_passwd stratusgraph -e "UPDATE currentmap SET Value = \"$next_map\" WHERE id='5';"
	mysql -u $mysql_user -p$mysql_passwd stratusgraph -e "UPDATE currentmap SET Value = '$current_rot' WHERE id='6';"
	path="data/rotations/beta"
	git submodule foreach git pull origin master
	echo $current_rot
	mysql -u $mysql_user -p$mysql_passwd stratusgraph -e "TRUNCATE currentrot;"
	number_of_maps=$(cat $path/$current_rot.yml | yq -r '.maps | length')
	for (( i=0; i < $number_of_maps; i++ ))
	do
		map_name=$(cat $path/$current_rot.yml | yq -r '.maps['$i']')
		mysql -u $mysql_user -p$mysql_passwd stratusgraph -e "INSERT INTO currentrot (map_name) VALUES (\"$map_name\");"
	done
	sleep 10s
done
