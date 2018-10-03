/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;

-- Dumping structure for table stratusgraph.currentmap
CREATE TABLE IF NOT EXISTS `currentmap` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `Metric` char(50) NOT NULL DEFAULT '0',
  `Value` char(50) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8;

-- Data exporting was unselected.
-- Dumping structure for table stratusgraph.currentrot
CREATE TABLE IF NOT EXISTS `currentrot` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `map_name` char(50) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8;

-- Data exporting was unselected.
-- Dumping structure for table stratusgraph.facts
CREATE TABLE IF NOT EXISTS `facts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `metric` char(50) NOT NULL DEFAULT '0',
  `value` char(50) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7203 DEFAULT CHARSET=utf8;

-- Data exporting was unselected.
-- Dumping structure for table stratusgraph.matchfacts
CREATE TABLE IF NOT EXISTS `matchfacts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `metric` char(50) NOT NULL DEFAULT '0',
  `value` char(50) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7202 DEFAULT CHARSET=utf8 ROW_FORMAT=DYNAMIC;

-- Data exporting was unselected.
-- Dumping structure for table stratusgraph.matchkills
CREATE TABLE IF NOT EXISTS `matchkills` (
  `numberofkills` int(11) NOT NULL DEFAULT 0,
  `player` char(50) DEFAULT 'player'
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.
-- Dumping structure for table stratusgraph.recentmatches
CREATE TABLE IF NOT EXISTS `recentmatches` (
  `id` char(50) NOT NULL,
  `When` char(50) NOT NULL,
  `Map` char(50) NOT NULL,
  `Length` char(50) NOT NULL,
  `Participants` char(50) NOT NULL,
  `Winner` char(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Data exporting was unselected.
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IF(@OLD_FOREIGN_KEY_CHECKS IS NULL, 1, @OLD_FOREIGN_KEY_CHECKS) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;