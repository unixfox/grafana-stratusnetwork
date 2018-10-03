#/bin/bash
while true
do
        matches=$(curl -s https://stratus.network/matches?server_id=59a1f894659e930001000004)
        mysql -u $mysql_user -p$mysql_passwd stratusgraph -e "TRUNCATE recentmatches;"
        for i in {2..20}
        do
            when=$(echo -n $matches | pup 'table tbody tr:nth-child('$i') td:nth-child(1) text{}' | tr -d '\n' | cut -c 3- | rev | cut -c 3- | rev | sed "s/&#39;/'/g")
            map_name=$(echo -n $matches | pup 'table tbody tr:nth-child('$i') td:nth-child(3) text{}' | tr -d '\n' | cut -c 2- | sed "s/&#39;/'/g")
            length=$(echo -n $matches | pup 'table tbody tr:nth-child('$i') td:nth-child(4) text{}' | tr -d '\n' | cut -c 2- | sed "s/&#39;/'/g")
            participants=$(echo -n $matches | pup 'table tbody tr:nth-child('$i') td:nth-child(5) text{}' | tr -d '\n' | cut -c 2- | sed "s/&#39;/'/g")
            winner=$(echo -n $matches | pup 'table tbody tr:nth-child('$i') td:nth-child(6) text{}' | tr -d '\n' | cut -c 2- | sed "s/&#39;/'/g")
            id=$(echo -n $matches | pup 'table tbody tr:nth-child('$i') td:nth-child(1) a attr{href}' | tr -d '\n' | cut -c 2- | pcregrep -o1 "\/(.*)")
            mysql -u $mysql_user -p$mysql_passwd stratusgraph -e "INSERT INTO recentmatches (\`id\`, \`When\`, \`Map\`, \`Length\`, \`Participants\`, \`Winner\`) VALUES ('$id', '$when', \"$map_name\", '$length', '$participants', '$winner');" &
        done
        sleep 4s
done
