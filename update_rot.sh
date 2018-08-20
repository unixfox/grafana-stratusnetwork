#!/bin/bash
while true
do
	truncate -s 0 log
	screen -S bot -p 0 -X stuff "info^M"
	sleep 1s
	info_bot=$(cat log)
	while echo $info_bot | grep -q "Unknown command"; do
		echo wait
		sleep 10s
		truncate -s 0 log
		screen -S bot -p 0 -X stuff "info^M"
		sleep 1s
		info_bot=$(cat log)
	done
	current_rot=$(echo $info_bot | sed 's/\x1b\[[0-9;]*m//g' | pcregrep -o1 "Current Rotation \((?<rot>[a-zA-Z]+)\)" | sed 's/.*/\l&/')
	timelimit=$(echo $info_bot | sed 's/\x1b\[[0-9;]*m//g' | pcregrep -o1 "The time limit is (?<timelimit>.+) with the result(.*?)")
	next_map=$(echo $info_bot | sed 's/\x1b\[[0;]*m/-/g' | sed 's/\x1b\[[0-9;]*m//g' | pcregrep -o1 "Next map: -(?<nxtmap>.+)- by(.*?)")
	players=$(echo $info_bot | sed 's/\x1b\[[0;]*m/=/g' | sed 's/\x1b\[[0-9;]*m//g' | pcregrep -o1 "===\[=Mixed=\]= ==(?<players>.+)= \((.*?)" | tr -d "=")
	if [[ -z $current_rot ]]; then
		echo null
		current_rot="default"
	fi
	if [[ -z $timelimit ]]; then
		timelimit="No time limit"
	fi
	if [[ -z $players ]]; then
		players="0"
	fi
	mysql -u $mysql_user -p$mysql_passwd stratusgraph -e "UPDATE currentmap SET Value = '$timelimit' WHERE id='4';"
	mysql -u $mysql_user -p$mysql_passwd stratusgraph -e "UPDATE currentmap SET Value = \"$next_map\" WHERE id='5';"
	mysql -u $mysql_user -p$mysql_passwd stratusgraph -e "UPDATE currentmap SET Value = '$current_rot' WHERE id='6';"
	mysql -u $mysql_user -p$mysql_passwd stratusgraph -e "UPDATE currentmap SET Value = '$players' WHERE id='8';"
	path="data/rotations/beta"
	git submodule --quiet foreach git pull origin master &> /dev/null
	mysql -u $mysql_user -p$mysql_passwd stratusgraph -e "TRUNCATE currentrot;"
	number_of_maps=$(cat $path/$current_rot.yml | yq -r '.maps | length')
	for (( i=0; i < $number_of_maps; i++ ))
	do
		map_name=$(cat $path/$current_rot.yml | yq -r '.maps['$i']')
		mysql -u $mysql_user -p$mysql_passwd stratusgraph -e "INSERT INTO currentrot (map_name) VALUES (\"$map_name\");"
	done
	sleep 2s
done
