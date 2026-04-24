/**
 * Curated lists of real-world place and storm references that must not
 * reach the database when ingesting external weather/geospatial data.
 *
 * Not exhaustive — meant as a defense-in-depth pass over API responses that
 * already shouldn't contain names. Fields we actually consume from Open-Meteo
 * are numeric; this filter exists to catch any free-text leak (station
 * descriptions, alert summaries, etc.) before it crosses into persist.
 *
 * See docs/plans/2026-04-19-001-feat-ambience-v1-plan.md Unit 2.
 */

/**
 * Atlantic + Pacific + EPAC tropical-cyclone name rolls (WMO lists, 6-year
 * rotations). Case-insensitive match.
 *
 * Not every first name that collides with a storm is dangerous in-fiction —
 * but the filter flags them all, and in prose we don't need person names
 * from external data in the first place.
 */
export const NOAA_STORM_NAMES: readonly string[] = [
  // 2020-2025 Atlantic rolls
  'Arthur', 'Bertha', 'Cristobal', 'Dolly', 'Edouard', 'Fay', 'Gonzalo',
  'Hanna', 'Isaias', 'Josephine', 'Kyle', 'Laura', 'Marco', 'Nana',
  'Omar', 'Paulette', 'Rene', 'Sally', 'Teddy', 'Vicky', 'Wilfred',
  'Ana', 'Bill', 'Claudette', 'Danny', 'Elsa', 'Fred', 'Grace',
  'Henri', 'Ida', 'Julian', 'Kate', 'Larry', 'Mindy', 'Nicholas',
  'Odette', 'Peter', 'Rose', 'Sam', 'Teresa', 'Victor', 'Wanda',
  'Alex', 'Bonnie', 'Colin', 'Danielle', 'Earl', 'Fiona', 'Gaston',
  'Hermine', 'Ian', 'Julia', 'Karl', 'Lisa', 'Martin', 'Nicole',
  'Owen', 'Paula', 'Richard', 'Shary', 'Tobias', 'Virginie', 'Walter',
  // Pacific / EPAC rolls (subset)
  'Adrian', 'Beatriz', 'Calvin', 'Dora', 'Eugene', 'Fernanda', 'Greg',
  'Hilary', 'Irwin', 'Jova', 'Kenneth', 'Lidia', 'Max', 'Norma',
  'Otis', 'Pilar', 'Ramon', 'Selma', 'Todd', 'Veronica', 'Wiley',
  // Notable historical (retired, but still might appear in archives)
  'Katrina', 'Harvey', 'Maria', 'Irma', 'Sandy', 'Andrew', 'Camille',
  'Dorian', 'Michael', 'Florence', 'Haiyan', 'Typhoon', 'Hurricane',
  'Cyclone',
];

/** Major real-world place names likely to appear in weather context. */
export const NOAA_PLACE_NAMES: readonly string[] = [
  // Continents + broad regions
  'North America', 'South America', 'Europe', 'Asia', 'Africa', 'Oceania',
  'Antarctica', 'Atlantic', 'Pacific', 'Indian Ocean', 'Arctic', 'Mediterranean',
  'Caribbean', 'Gulf of Mexico', 'Gulf of Alaska', 'Bering Sea', 'North Sea',
  // UK / Ireland (common Shadow-anchor vicinity)
  'United Kingdom', 'Great Britain', 'England', 'Scotland', 'Wales', 'Ireland',
  'Northern Ireland', 'London', 'Manchester', 'Liverpool', 'Birmingham',
  'Glasgow', 'Edinburgh', 'Cardiff', 'Belfast', 'Dublin', 'Leeds', 'Sheffield',
  'Heathrow', 'Gatwick', 'Plynlimon', 'Pumlumon', 'Severn', 'Thames',
  // US major cities / states (likely to appear in GFS metadata)
  'United States', 'USA', 'America', 'Washington', 'New York', 'California',
  'Texas', 'Florida', 'Illinois', 'Pennsylvania', 'Ohio', 'Michigan', 'Georgia',
  'Chicago', 'Boston', 'Philadelphia', 'Miami', 'Atlanta', 'Dallas', 'Houston',
  'Phoenix', 'Denver', 'Seattle', 'Portland', 'Minneapolis', 'Detroit',
  // European capitals + major cities
  'Paris', 'Berlin', 'Rome', 'Madrid', 'Amsterdam', 'Brussels', 'Vienna',
  'Prague', 'Warsaw', 'Stockholm', 'Oslo', 'Copenhagen', 'Helsinki', 'Athens',
  'Lisbon', 'Dublin', 'Reykjavik', 'Zurich', 'Geneva', 'Munich', 'Frankfurt',
  'Milan', 'Barcelona', 'Hamburg', 'Marseille', 'Lyon',
  // Asia-Pacific
  'Tokyo', 'Beijing', 'Shanghai', 'Seoul', 'Mumbai', 'Delhi', 'Bangkok',
  'Singapore', 'Jakarta', 'Manila', 'Sydney', 'Melbourne', 'Auckland',
  // Countries appearing in weather feeds
  'Canada', 'Mexico', 'Brazil', 'Argentina', 'Russia', 'China', 'Japan',
  'India', 'Indonesia', 'Australia', 'Germany', 'France', 'Italy', 'Spain',
  'Portugal', 'Netherlands', 'Belgium', 'Poland', 'Ukraine', 'Turkey',
];

/**
 * NOAA AWIPS/WMO station ID prefixes. Any token starting with these letters
 * followed by 3-4 uppercase alphanumerics likely a station identifier.
 */
export const NOAA_STATION_PREFIXES: readonly string[] = [
  'K',   // US ICAO (KATL, KSFO, ...)
  'EG',  // UK ICAO (EGLL = Heathrow, ...)
  'ED',  // Germany
  'LF',  // France
  'RJ',  // Japan
];
