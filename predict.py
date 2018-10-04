################################
#    STRATUS STAT UTILITIES    #
#       because why not        #
#                              #
# Author: Seth Phillips        #
################################

TITLE_TEXT = "Stratus Stat Utilities"
VERSION = "1.2"
MULTITHREADED = True
MIRROR = "https://stats.seth-phillips.com/stratus/"
DELAY = 15
HEADLESS_MODE = False
REALTIME_MODE = False

import os
import platform
import sys
if platform.system()=="Windows":
	UNIX = False
elif platform.system()=="Linux" or platform.system()=="Darwin":
	UNIX = True
else:
	print("[*] OS not supported!")
	exit()

if sys.version_info[0] < 3:
	print("You must run this on Python 3.x")
	exit()

import _thread
import argparse
import ctypes
import glob
import json
import math
import random
import re
import time

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from io import BytesIO
from shutil import copyfile

cli = argparse.ArgumentParser()
cli.add_argument('--multithreaded', "-m", help="bool :: use multithreaded player lookups", type=bool, default=MULTITHREADED)
cli.add_argument('--clone', "-c", help="str :: set the cURL stat URL/mirror", type=str, default=MIRROR)
cli.add_argument('--delay', "-d", help="int :: run the win predictor after a number of seconds", type=int, default=DELAY)
cli.add_argument('--headless', "-n", help="bool :: automatically run the program in non-interactive win predictor mode", type=bool, default=HEADLESS_MODE)
cli.add_argument('--realtime', "-r", help="bool :: run headless mode consistently", type=bool, default=REALTIME_MODE)
cli.add_argument('--mysql-host', help="str :: MySQL hostname", type=str, default="localhost")
cli.add_argument('--mysql-user', help="str :: MySQL username", type=str)
cli.add_argument('--mysql-pass', help="str :: MySQL password", type=str)
cli.add_argument('--mysql-db', help="str :: MySQL database", type=str)
cli.add_argument('--mysql-port', help="int :: MySQL database", type=int, default=3306)
ARGS = cli.parse_args()
MYSQL = ARGS.mysql_user != None and ARGS.mysql_db != None

try:
	from lxml import etree
	import lxml.html as lh
except ImportError:
	print("Your system is missing lxml. Please run `easy_install lxml` or `pip install lxml` before executing.")
	exit()

if MYSQL:
	try:
		import mysql.connector
	except ImportError:
		print("Your system is missing mysql-connector. Please run `easy_install mysql-connector` or `pip install mysql-connector` before executing.")
		exit()
	try:
		M_CNX = mysql.connector.connect(
			host = ARGS.mysql_host,
			user = ARGS.mysql_user,
			password = ARGS.mysql_pass,
			database = ARGS.mysql_db,
			port = ARGS.mysql_port,
			autocommit = True,
			use_unicode = True,
			charset = "utf8"
		)
		M_CURSOR = M_CNX.cursor()
	except mysql.connector.Error as err:
		print("[*] Error connecting to MySQL database with specified credentials:\n\t%s" % err)
		exit()

try:
	import pycurl
except ImportError:
	print("Your system is missing pycurl. Please run `easy_install pycurl` or `pip install pycurl` before executing.")
	exit()

try:
	from tabulate import tabulate
except ImportError:
	print("Your system is missing tabulate. Please run `easy_install tabulate` or `pip install tabulate` before executing.")
	exit()

try:
	from bs4 import BeautifulSoup as BS
except ImportError:
	print("Your system is missing BeautifulSoup. Please run `easy_install beautifulsoup4` or `pip install beautifulsoup4` before executing.")
	exit()

def logHeadless(data, newLine = True, mode = 'a'):
	global ARGS
	if ARGS.headless:
		with open("output.log", mode) as f:
			f.write(data + ('\n' if newLine else ''))

def output(data):
	global ARGS
	if ARGS.headless:
		logHeadless(data)
	else:
		print(data)

def exit(pause = True):
	if pause:
		os.system("read _ > /dev/null" if UNIX else "pause > nul")
	sys.exit(0)

def lazy_input(L):
	global UNIX
	os.system("read _ > /dev/null" if UNIX else "pause > nul")
	L.append(None)

def loadMessage():
	return random.choice(["Searching the cloud", "Getting Stratus status", "Completing the water cycle", "Querying for snakes and goobers", "Watching the clouds"]) + "...\n"

def curlRequest(url, forceNoMirror = False):
	global ARGS, UNIX
	try:
		buffer = BytesIO()
		c = pycurl.Curl()
		c.setopt(pycurl.URL, (url if "://" in url else (("https://stratus.network/" if ARGS.clone=="" or forceNoMirror else ARGS.clone) + str(url))))
		c.setopt(pycurl.USERAGENT, ("Mozilla/5.0 (X11; Linux i586; rv:31.0) Gecko/20100101 Firefox/31.0" if UNIX else "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:31.0) Gecko/20130401 Firefox/31.0"))
		c.setopt(pycurl.FOLLOWLOCATION, True)
		c.setopt(pycurl.POST, 0)
		c.setopt(pycurl.SSL_VERIFYPEER, 0)
		c.setopt(pycurl.SSL_VERIFYHOST, 0)
		c.setopt(pycurl.WRITEDATA, buffer)
		c.perform()
		response = c.getinfo(pycurl.RESPONSE_CODE)
		html = buffer.getvalue().decode("iso-8859-1")
		c.close()
		if response < 500:
			return [response, html.replace('\n', '')]
		print("[*] cURL responded with a server error while performing the request (%i). Is the website down?" % response)
		exit()
	except:
		print("[*] cURL performance failed. Is your internet operational?")
		exit()

def getStatPos(stat):
	# 0->rank; 1->playing_time; 2->kills; 3->deaths; 4->killed; 5->kd; 6->kk; 7->name
	if stat=="kills":
		return 2
	elif stat=="deaths":
		return 3
	elif stat=="killed":
		return 4
	else:
		return 1

def getPlayerStats(player, doCalculations = True, forceRenew = True):
	stats = dict()
	playerPage = curlRequest(player + ("?force-renew" if forceRenew else ""))
	
	if playerPage[0] > 399:
		stats["exists"] = False
	else:
		stats["exists"] = True
		playerPage = BS(playerPage[1], "lxml")
		
		try:
			# Raw stats
			stats["uuid"] = playerPage.findAll("img", {"class": "avatar"})[0]['src'][40:76]
			
			data = playerPage.findAll("div", {"class": "number"})
			if len(data) >= 7:
				stats["kills"] = int(data[0].get_text())
				stats["deaths"] = int(data[1].get_text())
				stats["friends"] = int(data[2].get_text())
				stats["kill_rank"] = int((data[3].get_text())[:-2])
				stats["reported_kd"] = float(data[4].get_text())
				stats["reported_kk"] = float(data[5].get_text())
				stats["droplets"] = int(float('.'.join(re.findall('\d+', data[6].get_text()))) * (1000 if (data[6].get_text())[-1:]=='k' else (1000000 if (data[6].get_text())[-1:]=='m' else (1000000000 if (data[6].get_text())[-1:]=='b' else 1))))
			else:
				stats["kills"] = 0
				stats["deaths"] = 0
				stats["friends"] = 0
				stats["kill_rank"] = 0
				stats["reported_kd"] = 0
				stats["reported_kk"] = 0
				stats["droplets"] = 0
			
			data = playerPage.findAll("h2")
			if len(data) > 0:
				stats["username"] = BS(str(data[0]), "lxml").findAll("span")[0].get_text().replace('\n', '').replace(' ', '')
			if len(data) > 3:
				for matches in data:
					subs = BS(str(matches), "lxml").findAll("small", {"class": "strong"})
					if len(subs) > 0:
						for sub in subs:
							if sub.text.lower()=="cores leaked":
								stats["cores"] = int(re.sub("\D", "", matches.get_text()))
								break
							elif sub.text.lower()=="monuments destroyed":
								stats["monuments"] = int(re.sub("\D", "", matches.get_text()))
								break
							elif sub.text.lower()=="wools placed":
								stats["wools"] = int(re.sub("\D", "", matches.get_text()))
								break
							elif sub.text.lower()=="flags captured":
								stats["flags"] = int(re.sub("\D", "", matches.get_text()))
								break
			if "username" not in stats:
				stats["username"] = player
			if "monuments" not in stats:
				stats["monuments"] = 0
			if "wools" not in stats:
				stats["wools"] = 0
			if "cores" not in stats:
				stats["cores"] = 0
			if "flags" not in stats:
				stats["flags"] = 0
			
			data = playerPage.findAll("section")
			if len(data) > 0:
				ranks = BS(str(data[0]), "lxml").findAll("a", {"class": "label"}) + BS(str(data[0]), "lxml").findAll("span", {"class": "label"})
				stats["ranks"] = len(ranks)
				donorRanks = ["strato", "alto", "cirro"]
				staffRanks = ["administrator", "developer", "senior moderator", "junior developer", "moderator", "map developer", "event coordinator", "official"]
				playerTags = (BS(str(ranks), "lxml").text).lower()
				stats["staff"] = True if any(x in playerTags for x in staffRanks) else False
				stats["donor"] = True if any(x in playerTags for x in donorRanks) else False
			else:
				stats["ranks"] = 0
				stats["staff"] = False
				stats["donor"] = False
			
			stats["tournament_winner"] = True if [x for x in data if "tournament winner" in (x.text).lower()] else False
			
			data = playerPage.findAll("h4", {"class": "strong"})
			if len(data) >= 3:
				stats["first_joined_days_ago"] = int(re.sub("\D", "", data[0].get_text()))
				stats["hours_played"] = int(re.sub("\D", "", data[1].get_text()))
				stats["teams_joined"] = int(re.sub("\D", "", data[2].get_text()))
			else:
				stats["first_joined_days_ago"] = 0
				stats["hours_played"] = 0
				stats["teams_joined"] = 0
			
			data = playerPage.findAll("div", {"class": "thumbnail trophy"})
			stats["trophies"] = int(len(data))
			
			data = playerPage.findAll("h5", {"class": "strong"})
			stats["team"] = True if [x for x in data if "team" in (x.text).lower()] else False
			
			# Calculated Stats
			if doCalculations:
				
				stats["kd"] = stats["kills"] / (1 if stats["deaths"]==0 else stats["deaths"])
				stats["kd_error"] = abs(stats["reported_kd"] - stats["kd"])
				stats["kk_max_death_error"] = math.ceil(0.49 * stats["kills"])
				
				# Averages
				stats["average_kills_per_hour"] = stats["kills"] / (1 if stats["hours_played"]==0 else stats["hours_played"])
				stats["average_deaths_per_hour"] = stats["deaths"] / (1 if stats["hours_played"]==0 else stats["hours_played"])
				stats["average_monuments_per_hour"] = stats["monuments"] / (1 if stats["hours_played"]==0 else stats["hours_played"])
				stats["average_wools_per_hour"] = stats["wools"] / (1 if stats["hours_played"]==0 else stats["hours_played"])
				stats["average_flags_per_hour"] = stats["flags"] / (1 if stats["hours_played"]==0 else stats["hours_played"])
				stats["average_cores_per_hour"] = stats["cores"] / (1 if stats["hours_played"]==0 else stats["hours_played"])
				stats["average_droplets_per_hour"] = stats["droplets"] / (1 if stats["hours_played"]==0 else stats["hours_played"])
				stats["average_new_friends_per_hour"] = stats["friends"] / (1 if stats["hours_played"]==0 else stats["hours_played"])
				stats["average_experienced_game_length_in_minutes"] = stats["hours_played"] * 60 / (1 if stats["teams_joined"]==0 else stats["teams_joined"])
				stats["average_kills_per_game"] = stats["kills"] / (1 if stats["teams_joined"]==0 else stats["teams_joined"])
				
				# Experimental
				stats["khpdg"] = stats["kd"] / (60.0 / (1 if stats["average_experienced_game_length_in_minutes"]==0 else stats["average_experienced_game_length_in_minutes"]))
				
				# Percents, expressed out of 100
				stats["percent_time_spent_on_stratus"] = 0 if stats["first_joined_days_ago"] < 7 else (stats["hours_played"] * 100 / (24 if stats["first_joined_days_ago"]==0 else (stats["first_joined_days_ago"] * 24)))
				stats["percent_waking_time_spent_on_stratus"] = 0 if stats["first_joined_days_ago"] < 7 else (stats["hours_played"] * 100 / (16 if stats["first_joined_days_ago"]==0 else (stats["first_joined_days_ago"] * 16)))
				
				# Unfortunately these stats have to retire since droplets can be spent, which can result in negative objective percentages.
				#stats["percent_droplets_are_kills"] = stats["kills"] * 100 / (1 if stats["droplets"]==0 else stats["droplets"])
				#stats["percent_droplets_are_objectives"] = 100 - stats["percent_droplets_are_kills"]
				
				# Merit is based on hours played on a scale to account for veteran players that idle. Using inverse regression
				# analysis, the above formula was found so that the stats of a user that has only played for less than an hour
				# is only worth 10% of what's reported; 100 hours constitutes 100% accuracy and 1000+ hours grants 120%.
				stats["kill_based_merit"] = (1.2 - (500 / stats["kills"])) if stats["kills"] > 454 else 0.1
				stats["time_based_merit"] = (1.2 - (5 / stats["hours_played"])) if stats["hours_played"] > 4 else 0.1
				stats["merit_multiplier"] = (stats["kill_based_merit"] + stats["time_based_merit"]) / 2
				
				# Reliability is solely based on teams joined and is used similar to merit to evaluate how well this player's
				# stats can be extrapolated to fit larger data sums
				stats["reliability_index"] = (1.0 - (50 / stats["teams_joined"])) if stats["teams_joined"] > 50 else 0.01
				
				stats["hours_until_one_million_droplets"] = 0 if stats["droplets"] > 1000000 else ((1000000 - stats["droplets"]) / (1 if stats["average_droplets_per_hour"]==0 else stats["average_droplets_per_hour"]))
			
		except KeyboardInterrupt:
			raise
		except:
			print("[*] Error translating web info! Did the website's page layout change?")
			exit()
	return stats

def playerStatsLookup():
	print("Enter player to lookup:")
	username = ""
	
	while True:
		username = input(" > ").replace(' ', '')
		if re.match("^[A-Za-z0-9_]{3,16}$", username):
			break
		else:
			print("Input must be a valid username. Try again:")
	
	print(loadMessage())
	stats = getPlayerStats(username)
	if stats["exists"]:
		for stat in stats:
			if stat != "exists":
				print("%s: %s" % (stat.replace('_', ' ').title(), stats[stat]))
	else:
		print("[*] The username specified does not exist!")

def getStatsList(stat, stop, verbose = True):
	players = list()
	statPos = getStatPos(stat)
	search = True
	page = 0
	
	while search:
		page += 1
		if verbose:
			print("Searching page %s..." % page)
		rowNum = 0
		statsList = curlRequest("stats?game=global&page=" + str(page) + "&sort=" + stat + "&time=eternity", True)
		if statsList[0] > 399:
			print("[*] cURL responded with a server error while requesting the stats page (%i). Is the website down?" % statsList[0])
			exit()
		for row in BS(statsList[1], "lxml").findAll("tr"):
			if not search:
				break
			dataNum = 0
			player = list()
			for data in BS(str(row), "lxml").findAll("td"):
				data = data.get_text()
				if dataNum==statPos:
					if int(data) <= stop - 1:
						search = False
						break
				dataNum += 1
				player.append(data)
			if len(player) > 0 and search:
				rowNum += 1
				players.append(player)
	
	if verbose:
		print("Last possible match found on page %s.\n" % page)
	
	return players

def reverseStatsLookup():
	stats = ["kills", "deaths", "killed"]
	print("Find player by:")
	for stat in stats:
		print("[%s] %s" % (stats.index(stat)+1, stat.title()))
	stat_num = 0
	while True:
		try:
			stat_num = int(input(" > "))
			if stat_num in range(1,len(stats)+1):
				break
			else:
				print("Number not in range of options. Try again:")
		except:
			print("Input must be a number. Try again:")
	stop = 0
	print("Enter number to lookup:")
	while True:
		try:
			stop = int(input(" > "))
			break
		except:
			print("Input must be a number. Try again:")
	print(loadMessage())
	stat = stats[stat_num-1].replace(' ', '_')
	statPos = getStatPos(stat)
	suspects = getStatsList(stat, stop)
	
	if len(suspects) > 0:
		closeMatches = [x for x in suspects if int(x[statPos]) <= stop*1.02]
		exactMatches = [x for x in closeMatches if int(x[statPos]) == stop]
		
		if len(exactMatches) > 0:
			print("Exact match%s: " % ("es" if len(exactMatches)>1 else ""))
			for player in exactMatches:
				print(" - %s (%s %s)" % (player[7], player[statPos], stat.replace('_',' ')))
				if player in closeMatches:
					closeMatches.remove(player)
		else:
			print("No exact matches found.")
		
		if len(closeMatches):
			print("Close match%s: " % ("es" if len(closeMatches)>1 else ""))
			for player in closeMatches:
				print(" - %s (%s %s)" % (player[7], player[statPos], stat.replace('_',' ')))
		else:
			print("No close matches (< 2% away) found.")
		
	else:
		print("No matches found. Decrease the number you're looking up for search results.")

def getStaff():
	staff = list()
	staffPage = curlRequest("staff")
	if staffPage[0] > 399:
		print("[*] cURL responded with a server error while requesting the stats page (%i). Is the website down?" % staffPage[0])
		exit()
	for member in (BS(staffPage[1], "lxml")).findAll("div", {"class": "staff-username strong"}):
		member = BS(str(member), "lxml").text
		if member not in staff:
			staff.append(member)
	return sorted(staff, key=str.lower)

def listStaff():
	staff = getStaff()
	print("Current listed staff (%s):" % len(staff))
	for member in staff:
		print(" - %s" % member)

def getCurrentPlayers():
	teamsPage = curlRequest("https://stratusapi.unixfox.eu/teams")
	if teamsPage[0] > 399:
		logHeadless("[*] Error making request!");
		print("[*] cURL responded with a server error while requesting the main match page (%i). Is unixfox's Stratus API down?" % teamsPage[0])
		exit()
	teams = json.loads(teamsPage[1])
	if "Observers" in teams:
		teams.pop("Observers", None)
	return teams

def getLatestMatch():
	matchPage = curlRequest("matches/?force-renew")
	if matchPage[0] > 399:
		logHeadless("[*] Error making request!");
		print("[*] cURL responded with a server error while requesting the main match page (%i). Is the website down?" % matchPage[0])
		exit()
	return ([x["href"] for x in (BS(str((BS(matchPage[1], "lxml").findAll("tr"))[1]), "lxml").findAll("a", href=True)) if x.text][0][9:])

def winPredictor(match = "", cycleStart = ""):
	global ARGS, MYSQL, M_CNX, M_CURSOR
	
	if not ARGS.headless:
		if ARGS.delay == 0:
			print("Enter a match to lookup (leave blank for the current match):")
			while True:
				match = input(" > ").replace(' ', '')
				if re.match("^[A-Za-z0-9\-]{0,36}$", match) or match.replace(' ', '')=="":
					break
				else:
					print("Input must be a valid match ID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx). Try again:")
		else:
			print("\nWaiting %s seconds before stating...\n(Or press any key to override & stat now)\n" % ARGS.delay)
			L = []
			_thread.start_new_thread(lazy_input, (L,))
			for x in range(0, ARGS.delay*10):
				time.sleep(.1)
				if L: break
		print(loadMessage())
	
	if match.replace(' ', '')=="":
		latestMatch = True
		logHeadless("Getting list of matches...");
		match = str(getLatestMatch())
	else:
		latestMatch = False
	
	logHeadless("Getting match info (%s)..." % match);
	matchPage = curlRequest("matches/" + match + "?force-renew")
	if matchPage[0] > 399:
		logHeadless("[*] Error making request!");
		print("[*] cURL responded with a server error while requesting the match page (%i). Does the match exist?" % matchPage[0])
		exit()
	matchPage = BS(matchPage[1], "lxml")
	
	logHeadless("Parsing response...");
	mapName = matchPage.find("h2").find("a").get_text().title()
	mapType = str(matchPage.find("img", {"class": "thumbnail"})).split('/')[4]
	# tdm, ctw, ctf, dtc, dtm, (dtcm,) ad, koth, blitz, rage, scorebox, arcade, gs, ffa, mixed, survival, payload, ranked
	
	if mapType in ["tdm", "ctw", "ctf", "dtc", "dtm", "dtcm", "koth", "blitz", "rage", "ffa", "mixed"] or ARGS.headless:
		mapExists = True
	else:
		if mapType=="" or mapType=="map.png" or mapType[:7]=="map.png":
			print("The match is missing its map.png file and therefore the gamemode cannot be determined!")
		else:
			print("The requested match type (\"%s\") is not a supported gamemode!" % mapType)
		print("Continue anyway? [y/n]")
		while True:
			option = input(" > ").lower()
			if option=='y' or option=='yes':
				mapExists = True
				break
			elif option=='n' or option=='no':
				mapExists = False
				break
			else:
				print("Please specify a \"yes\" or \"no\":")
	
	if mapExists:
		players = list()
		gstats = dict()
		composition = dict()
		
		if latestMatch or ARGS.headless:
			logHeadless("Getting the live team structure...");
			currentPlayers = getCurrentPlayers()
			for team in currentPlayers:
				if team.lower() not in composition:
					composition[team.lower()] = {"players": dict(), "stats": dict()}
				for player in currentPlayers[team]:
					composition[team.lower()]["players"][player] = dict()
		else:
			logHeadless("Using the legacy team structure...");
			teamRow = matchPage.findAll("div", {"class": "row"})[3]		
			for teamDiv in teamRow.findAll("div", {"class": "col-md-4"}):
				teamCount = teamDiv.find("h4", {"class": "strong"}).find("small")
				teamTag = teamDiv.find("h4", {"class": "strong"}).find("span", {"class": ["label label-danger pull-right", "label label-success pull-right"]})
				team = (teamDiv.find("h4", {"class": "strong"}).text.lower())[:-((0 if teamCount is None else len(teamCount.text)) + (0 if teamTag is None else len(teamTag.text)))]
				composition[team] = {"players": dict(), "stats": dict()}
				for player in [x["href"][1:] for x in teamDiv.findAll("a", href=True)]:
					composition[team]["players"][player] = dict()
		
		tPreFetch = time.time()
		tEst = 0
		
		logHeadless("Downloading player statistics...");
		if ARGS.multithreaded:
			if not ARGS.headless:
				print("NOTE: You've enabled the MULTITHREADED option, which is currently developmental and needs more timing tests.") # AKA "it works on my machine"
			with ThreadPoolExecutor(max_workers=4) as executor:
				for team in composition:
					print("\nGetting stats for players on %s (%d)..." % (team, len(composition[team]["players"])))
					for player in composition[team]["players"]:
						print("Getting stats for %s..." % player)
						composition[team]["players"][player] = executor.submit(getPlayerStats, player, True, False)
						players.append(player)
				tEst = len(players)*2.2
				print("\nQuerying web server for player statistics (this will take some time; ETA %ds)..." % math.ceil(tEst))
				for team in composition:
					for player in composition[team]["players"]:
						if not isinstance(composition[team]["players"][player], dict):
							composition[team]["players"][player] = (composition[team]["players"][player]).result()
		else:
			for team in composition:
				tEstTeam = len(composition[team]["players"])*2.5
				tEst += tEstTeam
				print("\nGetting stats for players on %s (%d; ETA %ds)..." % (team, len(composition[team]["players"]), math.ceil(tEstTeam)))
				for player in composition[team]["players"]:
					print("Getting stats for %s..." % player)
					composition[team]["players"][player] = getPlayerStats(player, True, False)
					players.append(player)
		
		for team in composition:
			for player in list(composition[team]["players"]):
				if not composition[team]["players"][player]["exists"]:
					composition[team]["players"].pop(player, None)
		
		tPostFetch = time.time()
		
		logHeadless("Compiling and computing statistics...");
		gstats["largest_kd"] = ["Nobody", 0]
		gstats["largest_adjusted_kd"] = ["Nobody", 0]
		gstats["most_kills_per_hour"] = ["Nobody", 0]
		gstats["most_deaths_per_hour"] = ["Nobody", 0]
		gstats["most_merit"] = ["Nobody", 0]
		gstats["largest_khpdg"] = ["Nobody", 0]
		gstats["smallest_khpdg"] = ["Nobody", 0]
		gstats["most_hours_played"] = ["Nobody", 0]
		gstats["most_friends"] = ["Nobody", 0]
		gstats["most_droplets"] = ["Nobody", 0]
		gstats["best_rank"] = ["Nobody", 0]
		gstats["worst_rank"] = ["Nobody", 0]
		gstats["most_trophies"] = ["Nobody", 0]
		
		gstats["top_monuments_per_hour"] = ["Nobody", 0]
		gstats["top_flags_per_hour"] = ["Nobody", 0]
		gstats["top_wools_per_hour"] = ["Nobody", 0]
		gstats["top_cores_per_hour"] = ["Nobody", 0]
		gstats["top_droplets_per_hour"] = ["Nobody", 0]
		gstats["top_new_friends_per_hour"] = ["Nobody", 0]
		gstats["top_kills_per_game"] = ["Nobody", 0]
		gstats["top_adjusted_kills_per_game"] = ["Nobody", 0]
		gstats["top_waking_time_spent_on_stratus"] = ["Nobody", 0]
		gstats["top_adjusted_waking_time_spent_on_stratus"] = ["Nobody", 0]
		gstats["longest_average_game_experience"] = ["Nobody", 0]
		gstats["longest_adjusted_average_game_experience"] = ["Nobody", 0]
		gstats["shortest_average_game_experience"] = ["Nobody", 0]
		gstats["shortest_adjusted_average_game_experience"] = ["Nobody", 0]
		
		gstats["average_kd"] = 0
		gstats["average_kill_rank"] = 0
		gstats["average_experienced_game_length_in_minutes"] = 0
		gstats["average_username_length"] = 0
		gstats["average_reliability_index"] = 0
		gstats["cumulative_reliability_index"] = 0
		
		for team in composition:
			print("\nCalculating larger statistics for %s..." % team)
			
			composition[team]["stats"]["number_of_players"] = len(composition[team]["players"])
			composition[team]["stats"]["total_kills"] = 0
			composition[team]["stats"]["total_deaths"] = 0
			composition[team]["stats"]["total_friends"] = 0
			composition[team]["stats"]["total_droplets"] = 0
			composition[team]["stats"]["total_monuments"] = 0
			composition[team]["stats"]["total_flags"] = 0
			composition[team]["stats"]["total_wools"] = 0
			composition[team]["stats"]["total_cores"] = 0
			composition[team]["stats"]["total_staff"] = 0
			composition[team]["stats"]["total_donors"] = 0
			composition[team]["stats"]["total_tournament_winners"] = 0
			composition[team]["stats"]["total_hours_played"] = 0
			composition[team]["stats"]["total_teams_joined"] = 0
			composition[team]["stats"]["total_nonunique_trophies"] = 0
			composition[team]["stats"]["total_team_members"] = 0
			
			composition[team]["stats"]["total_average_kills_per_hour"] = 0
			composition[team]["stats"]["total_average_deaths_per_hour"] = 0
			composition[team]["stats"]["total_average_monuments_per_hour"] = 0
			composition[team]["stats"]["total_average_flags_per_hour"] = 0
			composition[team]["stats"]["total_average_wools_per_hour"] = 0
			composition[team]["stats"]["total_average_cores_per_hour"] = 0
			composition[team]["stats"]["total_average_droplets_per_hour"] = 0
			composition[team]["stats"]["total_average_new_friends_per_hour"] = 0
			composition[team]["stats"]["total_average_experienced_game_length_in_minutes"] = 0
			composition[team]["stats"]["total_average_kills_per_game"] = 0
			
			# Nonce values don't really tell anything useful on their own, but are necessary for certain calculations (mostly averages)
			composition[team]["stats"]["nonce_total_time_based_merit"] = 0
			composition[team]["stats"]["nonce_total_kill_based_merit"] = 0
			composition[team]["stats"]["nonce_total_merit"] = 0
			composition[team]["stats"]["nonce_total_khpdg"] = 0
			composition[team]["stats"]["nonce_total_kill_rank"] = 0
			composition[team]["stats"]["nonce_total_reported_kd"] = 0
			composition[team]["stats"]["nonce_total_reported_kk"] = 0
			composition[team]["stats"]["nonce_total_username_length"] = 0
			composition[team]["stats"]["nonce_total_first_joined_days_ago"] = 0
			composition[team]["stats"]["nonce_total_kd"] = 0
			composition[team]["stats"]["nonce_total_kd_error"] = 0
			composition[team]["stats"]["nonce_total_percent_time_spent_on_stratus"] = 0
			composition[team]["stats"]["nonce_total_percent_waking_time_spent_on_stratus"] = 0
			#composition[team]["stats"]["nonce_total_percent_droplets_are_kills"] = 0
			#composition[team]["stats"]["nonce_total_percent_droplets_are_objectives"] = 0
			
			for player, pstats in composition[team]["players"].items():
				composition[team]["stats"]["total_kills"] += pstats["kills"]
				composition[team]["stats"]["total_deaths"] += pstats["deaths"]
				composition[team]["stats"]["total_friends"] += pstats["friends"]
				composition[team]["stats"]["total_droplets"] += pstats["droplets"]
				composition[team]["stats"]["total_monuments"] += pstats["monuments"]
				composition[team]["stats"]["total_wools"] += pstats["wools"]
				composition[team]["stats"]["total_flags"] += pstats["flags"]
				composition[team]["stats"]["total_cores"] += pstats["cores"]
				composition[team]["stats"]["total_staff"] += 1 if pstats["staff"] else 0
				composition[team]["stats"]["total_donors"] += 1 if pstats["donor"] else 0
				composition[team]["stats"]["total_tournament_winners"] += 1 if pstats["tournament_winner"] else 0
				composition[team]["stats"]["total_hours_played"] += pstats["hours_played"]
				composition[team]["stats"]["total_teams_joined"] += pstats["teams_joined"]
				composition[team]["stats"]["total_nonunique_trophies"] += pstats["trophies"]
				composition[team]["stats"]["total_team_members"] += 1 if pstats["team"] else 0
				composition[team]["stats"]["total_average_kills_per_hour"] += pstats["average_kills_per_hour"]
				composition[team]["stats"]["total_average_deaths_per_hour"] += pstats["average_deaths_per_hour"]
				composition[team]["stats"]["total_average_monuments_per_hour"] += pstats["average_monuments_per_hour"]
				composition[team]["stats"]["total_average_flags_per_hour"] += pstats["average_flags_per_hour"]
				composition[team]["stats"]["total_average_wools_per_hour"] += pstats["average_wools_per_hour"]
				composition[team]["stats"]["total_average_cores_per_hour"] += pstats["average_cores_per_hour"]
				composition[team]["stats"]["total_average_droplets_per_hour"] += pstats["average_droplets_per_hour"]
				composition[team]["stats"]["total_average_new_friends_per_hour"] += pstats["average_new_friends_per_hour"]
				composition[team]["stats"]["total_average_experienced_game_length_in_minutes"] += pstats["average_experienced_game_length_in_minutes"]
				composition[team]["stats"]["total_average_kills_per_game"] += pstats["average_kills_per_game"]
				
				composition[team]["stats"]["nonce_total_time_based_merit"] += pstats["time_based_merit"]
				composition[team]["stats"]["nonce_total_kill_based_merit"] += pstats["kill_based_merit"]
				composition[team]["stats"]["nonce_total_merit"] += pstats["merit_multiplier"]
				composition[team]["stats"]["nonce_total_khpdg"] += pstats["khpdg"]
				
				composition[team]["stats"]["nonce_total_kill_rank"] += pstats["kill_rank"]
				composition[team]["stats"]["nonce_total_reported_kd"] += pstats["reported_kd"]
				composition[team]["stats"]["nonce_total_reported_kk"] += pstats["reported_kk"]
				composition[team]["stats"]["nonce_total_username_length"] += len(pstats["username"])
				composition[team]["stats"]["nonce_total_first_joined_days_ago"] += pstats["first_joined_days_ago"]
				composition[team]["stats"]["nonce_total_kd"] += pstats["kd"]
				composition[team]["stats"]["nonce_total_kd_error"] += pstats["kd_error"]
				composition[team]["stats"]["nonce_total_percent_time_spent_on_stratus"] += pstats["percent_time_spent_on_stratus"]
				composition[team]["stats"]["nonce_total_percent_waking_time_spent_on_stratus"] += pstats["percent_waking_time_spent_on_stratus"]
				#composition[team]["stats"]["nonce_total_percent_droplets_are_kills"] += pstats["percent_droplets_are_kills"]
				#composition[team]["stats"]["nonce_total_percent_droplets_are_objectives"] += pstats["percent_droplets_are_objectives"]
				
				if pstats["kd"] > gstats["largest_kd"][1]:
					gstats["largest_kd"][0] = pstats["username"]
					gstats["largest_kd"][1] = pstats["kd"]
				if pstats["kd"]*pstats["merit_multiplier"] > gstats["largest_adjusted_kd"][1]:
					gstats["largest_adjusted_kd"][0] = pstats["username"]
					gstats["largest_adjusted_kd"][1] = pstats["kd"]
				if pstats["average_kills_per_hour"] > gstats["most_kills_per_hour"][1]:
					gstats["most_kills_per_hour"][0] = pstats["username"]
					gstats["most_kills_per_hour"][1] = pstats["average_kills_per_hour"]
				if pstats["average_deaths_per_hour"] > gstats["most_deaths_per_hour"][1]:
					gstats["most_deaths_per_hour"][0] = pstats["username"]
					gstats["most_deaths_per_hour"][1] = pstats["average_deaths_per_hour"]
				if pstats["merit_multiplier"] > gstats["most_merit"][1]:
					gstats["most_merit"][0] = pstats["username"]
					gstats["most_merit"][1] = pstats["merit_multiplier"]
				if pstats["khpdg"] > gstats["largest_khpdg"][1]:
					gstats["largest_khpdg"][0] = pstats["username"]
					gstats["largest_khpdg"][1] = pstats["khpdg"]
				if pstats["khpdg"] < gstats["smallest_khpdg"][1] or gstats["smallest_khpdg"][0]=="Nobody":
					gstats["smallest_khpdg"][0] = pstats["username"]
					gstats["smallest_khpdg"][1] = pstats["khpdg"]
				if pstats["hours_played"] > gstats["most_hours_played"][1]:
					gstats["most_hours_played"][0] = pstats["username"]
					gstats["most_hours_played"][1] = pstats["hours_played"]
				if pstats["friends"] > gstats["most_friends"][1]:
					gstats["most_friends"][0] = pstats["username"]
					gstats["most_friends"][1] = pstats["friends"]
				if pstats["droplets"] > gstats["most_droplets"][1]:
					gstats["most_droplets"][0] = pstats["username"]
					gstats["most_droplets"][1] = pstats["droplets"]
				if pstats["kill_rank"] < gstats["best_rank"][1] or gstats["best_rank"][0]=="Nobody":
					gstats["best_rank"][0] = pstats["username"]
					gstats["best_rank"][1] = pstats["kill_rank"]
				if pstats["kill_rank"] > gstats["worst_rank"][1]:
					gstats["worst_rank"][0] = pstats["username"]
					gstats["worst_rank"][1] = pstats["kill_rank"]
				if pstats["trophies"] > gstats["most_trophies"][1]:
					gstats["most_trophies"][0] = pstats["username"]
					gstats["most_trophies"][1] = pstats["trophies"]
				
				if pstats["average_monuments_per_hour"] > gstats["top_monuments_per_hour"][1]:
					gstats["top_monuments_per_hour"][0] = pstats["username"]
					gstats["top_monuments_per_hour"][1] = pstats["average_monuments_per_hour"]
				if pstats["average_wools_per_hour"] > gstats["top_wools_per_hour"][1]:
					gstats["top_wools_per_hour"][0] = pstats["username"]
					gstats["top_wools_per_hour"][1] = pstats["average_wools_per_hour"]
				if pstats["average_flags_per_hour"] > gstats["top_flags_per_hour"][1]:
					gstats["top_flags_per_hour"][0] = pstats["username"]
					gstats["top_flags_per_hour"][1] = pstats["average_flags_per_hour"]
				if pstats["average_cores_per_hour"] > gstats["top_cores_per_hour"][1]:
					gstats["top_cores_per_hour"][0] = pstats["username"]
					gstats["top_cores_per_hour"][1] = pstats["average_cores_per_hour"]
				if pstats["average_droplets_per_hour"] > gstats["top_droplets_per_hour"][1]:
					gstats["top_droplets_per_hour"][0] = pstats["username"]
					gstats["top_droplets_per_hour"][1] = pstats["average_droplets_per_hour"]
				if pstats["average_new_friends_per_hour"] > gstats["top_new_friends_per_hour"][1]:
					gstats["top_new_friends_per_hour"][0] = pstats["username"]
					gstats["top_new_friends_per_hour"][1] = pstats["average_new_friends_per_hour"]
				if pstats["average_kills_per_game"] > gstats["top_kills_per_game"][1]:
					gstats["top_kills_per_game"][0] = pstats["username"]
					gstats["top_kills_per_game"][1] = pstats["average_kills_per_game"]
				if pstats["average_kills_per_game"]*pstats["merit_multiplier"] > gstats["top_adjusted_kills_per_game"][1]:
					gstats["top_adjusted_kills_per_game"][0] = pstats["username"]
					gstats["top_adjusted_kills_per_game"][1] = pstats["average_kills_per_game"]
				if pstats["percent_waking_time_spent_on_stratus"] > gstats["top_waking_time_spent_on_stratus"][1]:
					gstats["top_waking_time_spent_on_stratus"][0] = pstats["username"]
					gstats["top_waking_time_spent_on_stratus"][1] = pstats["percent_waking_time_spent_on_stratus"]
				if pstats["percent_waking_time_spent_on_stratus"]*pstats["merit_multiplier"] > gstats["top_adjusted_waking_time_spent_on_stratus"][1]:
					gstats["top_adjusted_waking_time_spent_on_stratus"][0] = pstats["username"]
					gstats["top_adjusted_waking_time_spent_on_stratus"][1] = pstats["percent_waking_time_spent_on_stratus"]
				if pstats["average_experienced_game_length_in_minutes"] > gstats["longest_average_game_experience"][1]:
					gstats["longest_average_game_experience"][0] = pstats["username"]
					gstats["longest_average_game_experience"][1] = pstats["average_experienced_game_length_in_minutes"]
				if pstats["average_experienced_game_length_in_minutes"]*pstats["merit_multiplier"] > gstats["longest_adjusted_average_game_experience"][1]:
					gstats["longest_adjusted_average_game_experience"][0] = pstats["username"]
					gstats["longest_adjusted_average_game_experience"][1] = pstats["average_experienced_game_length_in_minutes"]
				if gstats["shortest_average_game_experience"][0]=="Nobody" or pstats["average_experienced_game_length_in_minutes"] < gstats["shortest_average_game_experience"][1]:
					gstats["shortest_average_game_experience"][0] = pstats["username"]
					gstats["shortest_average_game_experience"][1] = pstats["average_experienced_game_length_in_minutes"]
				if gstats["shortest_adjusted_average_game_experience"][0]=="Nobody" or pstats["average_experienced_game_length_in_minutes"]/pstats["merit_multiplier"] < gstats["shortest_adjusted_average_game_experience"][1]:
					gstats["shortest_adjusted_average_game_experience"][0] = pstats["username"]
					gstats["shortest_adjusted_average_game_experience"][1] = pstats["average_experienced_game_length_in_minutes"]
				
				gstats["average_reliability_index"] += pstats["reliability_index"]
				gstats["cumulative_reliability_index"] *= pstats["reliability_index"]
			
			teamSize = 1 if len(composition[team]["players"])==0 else len(composition[team]["players"])
			composition[team]["stats"]["average_kills"] = composition[team]["stats"]["total_kills"] / teamSize
			composition[team]["stats"]["average_deaths"] = composition[team]["stats"]["total_deaths"] / teamSize
			composition[team]["stats"]["average_friends"] = composition[team]["stats"]["total_friends"] / teamSize
			composition[team]["stats"]["average_kill_rank"] = int(composition[team]["stats"]["nonce_total_kill_rank"] / teamSize)
			composition[team]["stats"]["average_reported_kd"] = composition[team]["stats"]["nonce_total_reported_kd"] / teamSize
			composition[team]["stats"]["average_reported_kk"] = composition[team]["stats"]["nonce_total_reported_kk"] / teamSize
			composition[team]["stats"]["average_droplets"] = composition[team]["stats"]["total_droplets"] / teamSize
			composition[team]["stats"]["average_username_length"] = composition[team]["stats"]["nonce_total_username_length"] / teamSize
			composition[team]["stats"]["average_monuments"] = composition[team]["stats"]["total_monuments"] / teamSize
			composition[team]["stats"]["average_flags"] = composition[team]["stats"]["total_flags"] / teamSize
			composition[team]["stats"]["average_wools"] = composition[team]["stats"]["total_wools"] / teamSize
			composition[team]["stats"]["average_cores"] = composition[team]["stats"]["total_cores"] / teamSize
			composition[team]["stats"]["average_first_joined_days_ago"] = composition[team]["stats"]["nonce_total_first_joined_days_ago"] / teamSize
			composition[team]["stats"]["average_hours_played"] = composition[team]["stats"]["total_hours_played"] / teamSize
			composition[team]["stats"]["average_teams_joined"] = composition[team]["stats"]["total_teams_joined"] / teamSize
			composition[team]["stats"]["average_trophies"] = composition[team]["stats"]["total_nonunique_trophies"] / teamSize
			composition[team]["stats"]["average_kd"] = composition[team]["stats"]["nonce_total_kd"] / teamSize
			composition[team]["stats"]["average_kd_error"] = composition[team]["stats"]["nonce_total_kd_error"] / teamSize
			composition[team]["stats"]["average_kills_per_hour"] = composition[team]["stats"]["total_average_kills_per_hour"] / teamSize
			composition[team]["stats"]["average_deaths_per_hour"] = composition[team]["stats"]["total_average_deaths_per_hour"] / teamSize
			composition[team]["stats"]["average_monuments_per_hour"] = composition[team]["stats"]["total_average_monuments_per_hour"] / teamSize
			composition[team]["stats"]["average_flags_per_hour"] = composition[team]["stats"]["total_average_flags_per_hour"] / teamSize
			composition[team]["stats"]["average_wools_per_hour"] = composition[team]["stats"]["total_average_wools_per_hour"] / teamSize
			composition[team]["stats"]["average_cores_per_hour"] = composition[team]["stats"]["total_average_cores_per_hour"] / teamSize
			composition[team]["stats"]["average_droplets_per_hour"] = composition[team]["stats"]["total_average_droplets_per_hour"] / teamSize
			composition[team]["stats"]["average_new_friends_per_hour"] = composition[team]["stats"]["total_average_new_friends_per_hour"] / teamSize
			composition[team]["stats"]["average_experienced_game_length_in_minutes"] = composition[team]["stats"]["total_average_experienced_game_length_in_minutes"] / teamSize
			composition[team]["stats"]["average_kills_per_game"] = composition[team]["stats"]["total_average_kills_per_game"] / teamSize
			composition[team]["stats"]["average_percent_time_spent_on_stratus"] = composition[team]["stats"]["nonce_total_percent_time_spent_on_stratus"] / teamSize
			composition[team]["stats"]["average_percent_waking_time_spent_on_stratus"] = composition[team]["stats"]["nonce_total_percent_waking_time_spent_on_stratus"] / teamSize
			#composition[team]["stats"]["average_percent_droplets_are_kills"] = composition[team]["stats"]["nonce_total_percent_droplets_are_kills"] / teamSize
			#composition[team]["stats"]["average_percent_droplets_are_objectives"] = composition[team]["stats"]["nonce_total_percent_droplets_are_objectives"] / teamSize
			composition[team]["stats"]["average_time_based_merit"] = composition[team]["stats"]["nonce_total_time_based_merit"] / teamSize
			composition[team]["stats"]["average_kill_based_merit"] = composition[team]["stats"]["nonce_total_kill_based_merit"] / teamSize
			composition[team]["stats"]["average_merit"] = composition[team]["stats"]["nonce_total_merit"] / teamSize
			composition[team]["stats"]["average_khpdg"] = composition[team]["stats"]["nonce_total_khpdg"] / teamSize
			
			composition[team]["stats"]["raw_score"] = 0
			if mapType == "tdm":
				composition[team]["stats"]["raw_score"] = 0.8*composition[team]["stats"]["average_kd"] + 0.2*composition[team]["stats"]["average_kills_per_game"]
			elif mapType == "ctw":
				composition[team]["stats"]["raw_score"] = 0.6*composition[team]["stats"]["average_kd"] + 0.4*composition[team]["stats"]["average_wools_per_hour"]
			elif mapType == "ctf":
				composition[team]["stats"]["raw_score"] = 0.6*composition[team]["stats"]["average_khpdg"] + 0.4*composition[team]["stats"]["average_flags_per_hour"]
			elif mapType == "dtc":
				composition[team]["stats"]["raw_score"] = 0.6*composition[team]["stats"]["average_kd"] + 0.4*composition[team]["stats"]["average_cores_per_hour"]
			elif mapType == "dtm":
				composition[team]["stats"]["raw_score"] = 0.6*composition[team]["stats"]["average_kd"] + 0.4*composition[team]["stats"]["average_monuments_per_hour"]
			elif mapType == "dtcm":
				composition[team]["stats"]["raw_score"] = 0.5*composition[team]["stats"]["average_kd"] + 0.3*composition[team]["stats"]["average_monuments_per_hour"] + 0.2*composition[team]["stats"]["average_cores_per_hour"]
			elif mapType == "koth":
				composition[team]["stats"]["raw_score"] = composition[team]["stats"]["average_kd"]
			elif mapType == "blitz":
				composition[team]["stats"]["raw_score"] = composition[team]["stats"]["average_khpdg"]
			elif mapType == "rage":
				composition[team]["stats"]["raw_score"] = 0 if composition[team]["stats"]["average_khpdg"]==0 or composition[team]["stats"]["average_experienced_game_length_in_minutes"]==0 else (1 / (composition[team]["stats"]["average_khpdg"] * composition[team]["stats"]["average_experienced_game_length_in_minutes"]))
			elif mapType == "ffa":
				# Stratus matches don't seem to show any players on FFA matches
				composition[team]["stats"]["raw_score"] = composition[team]["stats"]["average_khpdg"] + (0 if composition[team]["stats"]["average_kill_rank"]==0 else (1 / composition[team]["stats"]["average_kill_rank"]))
			elif mapType == "mixed":
				composition[team]["stats"]["raw_score"] = 0.5*composition[team]["stats"]["average_kd"] + 0.1*composition[team]["stats"]["average_monuments_per_hour"] + 0.1*composition[team]["stats"]["average_wools_per_hour"] + 0.1*composition[team]["stats"]["average_cores_per_hour"] + 0.2*composition[team]["stats"]["average_kills_per_game"]
			else:
				mapType = "UNKNOWN"
				print("[*] Generalizing statistics to rely on KHPDG; approximation of estimation will be lower.")
				composition[team]["stats"]["raw_score"] = 1.0*composition[team]["stats"]["average_khpdg"]
			
			composition[team]["stats"]["raw_score"] += 0.02*composition[team]["stats"]["total_donors"] + 0.03*composition[team]["stats"]["total_tournament_winners"]
			composition[team]["stats"]["adjusted_score"] = composition[team]["stats"]["raw_score"] * composition[team]["stats"]["average_merit"]
			
			gstats["average_kd"] += composition[team]["stats"]["average_kd"]
			gstats["average_kill_rank"] += composition[team]["stats"]["average_kill_rank"]
			gstats["average_experienced_game_length_in_minutes"] += composition[team]["stats"]["average_experienced_game_length_in_minutes"]
			gstats["average_username_length"] += composition[team]["stats"]["average_username_length"]
		
		numTeams = len(composition)
		almostASCII = ['0','1','2','3','4','5','6','7','8','9','a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z']
		
		gstats["total_players"] = len(players)
		gstats["username_amalgamation"] = ""
		
		# This section was just a creative outlet that ended in disappointment
		username_mess = [[],[],[],[],[],[],[],[],[],[],[],[],[],[],[],[]]
		for playerName in players:
			i=0
			for letter in playerName:
				username_mess[i].append(letter)
				i+=1
		for letters in username_mess:
			letterProperties = {"lowers": 0, "uppers": 0, "numbers": 0, "unders": 0}
			for character in letters:
				if character==character.lower():
					letterProperties["lowers"] += 1
				elif character==character.upper():
					letterProperties["uppers"] += 1
				elif character.isdigit():
					letterProperties["numbers"] += 1
				else:
					letterProperties["unders"] += 1
			if letterProperties["lowers"]+letterProperties["uppers"] > letterProperties["numbers"]:
				letters = [ord(x.lower() if letterProperties["lowers"] > letterProperties["uppers"] else x.upper()) for x in letters if not x.isdigit()]
				gstats["username_amalgamation"] += chr(round(sum(letters) / (1 if len(letters)==0 else len(letters))))
			elif letterProperties["numbers"] > letterProperties["unders"]:
				numbers = [x for x in letters if x.isdigit()]
				gstats["username_amalgamation"] += chr(round(sum(numbers) / (1 if len(numbers)==0 else len(numbers))))
			else:
				gstats["username_amalgamation"] += "_"
		
		gstats["average_kd"] = gstats["average_kd"] / (1 if numTeams==0 else numTeams)
		gstats["average_kill_rank"] = round(gstats["average_kill_rank"] / (1 if numTeams==0 else numTeams))
		gstats["average_experienced_game_length_in_minutes"] = gstats["average_experienced_game_length_in_minutes"] / (1 if numTeams==0 else numTeams)
		gstats["average_username_length"] = gstats["average_username_length"] / (1 if numTeams==0 else numTeams)
		gstats["average_reliability_index"] = gstats["average_reliability_index"] / (1 if gstats["total_players"]==0 else gstats["total_players"])
		gstats["username_amalgamation"] = gstats["username_amalgamation"][:round(gstats["average_username_length"])]
		
		tPostCalc = time.time()
		
		if numTeams>0:
		
			if not UNIX:
				ctypes.windll.kernel32.SetConsoleTitleW(TITLE_TEXT)
				os.system("cls")
			else:
				os.system("clear")
			
			logHeadless(";;;")
			
			output("=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n          Meta Statistics          \n=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n")
			
			tTotal = tPostCalc - tPreFetch
			if cycleStart!="":
				output("Cycle start time: %s" % cycleStart)
			output("Program took %.2fs to fetch base player statistics and %.5fs to calculate all other statistics, totaling %.2fs." % (tPostFetch - tPreFetch, tPostCalc - tPostFetch, tTotal))
			output("Expected total run time was %.2fs." % tEst)
			output("Latency margin of error is %.2f%%." % abs((tEst - tTotal) * 100 / tTotal))
			
			output("\n\n=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n         Global Statistics         \n=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n")
			output("Map name: %s" % mapName)
			output("Detected map type: %s" % mapType.upper())
			for stat in gstats:
				if isinstance(gstats[stat], list):
					if isinstance(gstats[stat][1], float):
						output("%s: %s (%.2f)" % (stat.replace('_', ' ').title(), gstats[stat][0], gstats[stat][1]))
					else:
						output("%s: %s (%s)" % (stat.replace('_', ' ').title(), gstats[stat][0], gstats[stat][1]))
				else:
					if isinstance(gstats[stat], float):
						output("%s: %.2f" % (stat.replace('_', ' ').title(), gstats[stat]))
					else:
						output("%s: %s" % (stat.replace('_', ' ').title(), gstats[stat]))
			
			output(("\n\n=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n Team Statistics for Current Match \n=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n") if latestMatch else ("\n\n=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n Team Statistics for %s \n=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=\n" % match))
			
			tableHeaders = [x.title() for x in composition]
			tableHeaders.insert(0, "")
			tableData = list()
			
			for stat in composition[next(iter(composition))]["stats"]:
				if stat[:5] != "nonce" and stat[:13] != "total_average":
					substat = list()
					substat.append(stat.replace('_', ' ').title())
					for team in composition:
						substat.append(composition[team]["stats"][stat])
					tableData.append(substat)
			
			output(tabulate(tableData, headers=tableHeaders))
			
			scoreTotal = 0
			winner = ["nobody", 0]
			assuredness_index = 1
			for team in composition:
				scoreTotal += composition[team]["stats"]["adjusted_score"]
				if composition[team]["stats"]["adjusted_score"] > winner[1]:
					assuredness_index = composition[team]["stats"]["adjusted_score"] / (1 if composition[team]["stats"]["adjusted_score"]==0 else composition[team]["stats"]["adjusted_score"] + winner[1])
					winner[0] = team
					winner[1] = composition[team]["stats"]["adjusted_score"]
				else:
					assuredness_index = winner[1] / (1 if composition[team]["stats"]["adjusted_score"]==0 else composition[team]["stats"]["adjusted_score"] + winner[1])
			
			output("\n")
			for team in composition:
				output("%s has a %.2f%% chance of winning." % (team.title(), (composition[team]["stats"]["adjusted_score"]*100 / (1 if scoreTotal is 0 else scoreTotal))))
			
			if assuredness_index < 0.525 or gstats["average_reliability_index"] < 0.4:
				output("\nIt's too hard to tell who will win this game due to a low player stat accuracy (%.2f%%) or a low decision accuracy (%.2f%%)." % (gstats["average_reliability_index"]*100, assuredness_index*100))
				if MYSQL:
					M_CURSOR.execute("UPDATE currentmap SET Value = 'Too close to predict' WHERE id='7'")
			elif assuredness_index > 0.825 and gstats["average_reliability_index"] > 0.7:
				output("\nI am very sure that %s will win with a %.2f%% player stat accuracy and a high decision accuracy (%.2f%%)." % (winner[0].title(), gstats["average_reliability_index"]*100, assuredness_index*100))
				if MYSQL:
					M_CURSOR.execute("UPDATE currentmap SET Value = '%s (%.2f%% chance)' WHERE id='7'" % (winner[0].title(), assuredness_index*100))
			else:
				output("\nI predict that %s will win with a %.2f%% player stat accuracy and a %.2f%% decision accuracy." % (winner[0].title(), gstats["average_reliability_index"]*100, assuredness_index*100))
				if MYSQL:
					M_CURSOR.execute("UPDATE currentmap SET Value = '%s (%.2f%% chance)' WHERE id='7'" % (winner[0].title(), assuredness_index*100))
		else:
			output("[*] The team list is empty and therefore no stats can be found!")
	else:
		print("\nAborted. Press any key to continue.")

def main():
	global UNIX, TITLE_TEXT, VERSION
	os.chdir(os.path.dirname(os.path.abspath(__file__)))
	EXIT = False
	while not EXIT:
		if not UNIX:
			ctypes.windll.kernel32.SetConsoleTitleW(TITLE_TEXT)
			os.system("cls")
		else:
			os.system("clear")
		
		print("=-=-=-=-=-=-=-=-=-=-=-=-=-=-=")
		print(" %s v%s" % (TITLE_TEXT, VERSION))
		print("=-=-=-=-=-=-=-=-=-=-=-=-=-=-=")
		
		options = ["Get a player's stats", "Reverse stats lookup", "List staff members", "Win predictor", "Exit"]
		print("Pick a utility:")
		for stat in options:
			print("[%s] %s" % (options.index(stat)+1, stat))
		option_num = 0
		while True:
			try:
				option_num = int(input(" > "))
				if option_num in range(1,len(options)+1):
					break
				else:
					print("Number not in range of options. Try again:")
			except:
				print("Input must be a number. Try again:")
		if option_num == 1:
			playerStatsLookup()
		elif option_num == 2:
			reverseStatsLookup()
		elif option_num == 3:
			listStaff()
		elif option_num == 4:
			winPredictor()
		else:
			EXIT = True
		if not EXIT:
			os.system("read _ > /dev/null" if UNIX else "pause > nul")
	print("Goodbye.")
	exit(False)

if __name__ == '__main__':
	try:
		if ARGS.headless:
			print("Headless mode is enabled. Events will be recorded to `output.log`. Keyboard terminate / pkill if the loop gets messy.")
			logHeadless("", False)
			
			lastMatch = ""
			waitCycle = 30
			while True:
				latestMatch = str(getLatestMatch())
				if not ARGS.realtime and latestMatch==lastMatch:
					print("[%s] No match difference. Pinging again in %i seconds..." % (datetime.now().isoformat(), waitCycle))
					time.sleep(waitCycle)
					if waitCycle < 300:
						waitCycle += 1
				else:
					waitCycle = 30
					lastMatch = latestMatch
					
					if not UNIX:
						os.system("cls")
					else:
						os.system("clear")
					
					print("Cycle beginning.")
					cycleStart = datetime.now().isoformat()
					logHeadless("Cycle start time: ", False, 'w')
					logHeadless(cycleStart)
					time.sleep(20 if ARGS.delay==0 else ARGS.delay)
					winPredictor(lastMatch, cycleStart)
					copyfile('output.log', 'complete_output.log')
					print("Cycle complete. Running again in %i seconds..." % 15 if ARGS.realtime else 60)
					time.sleep(15 if ARGS.realtime else 60)
		else:
			main()
	except KeyboardInterrupt:
		print("\n\nTerminating.")
		sys.exit(0)