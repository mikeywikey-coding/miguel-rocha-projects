/**
 * shared.js — Travian Settlement Planner: Shared Constants & Utilities
 *
 * This module is loaded by background.js, content.js, and popup.js.
 * It attaches everything to `globalThis.TSP` so it works in all contexts
 * (background service worker, content scripts, popup) without ES module imports.
 */

/* eslint-disable no-unused-vars */
"use strict";

globalThis.TSP = (() => {
	// =========================================================================
	//  BROWSER API SHIM
	// =========================================================================

	/** @type {typeof chrome} Chrome extension API */
	const api = chrome;

	// =========================================================================
	//  TIME CONSTANTS (avoids magic numbers throughout the codebase)
	// =========================================================================

	const SECS_PER_DAY = 86400;
	const SECS_PER_HOUR = 3600;
	const SECS_PER_MIN = 60;

	/** Pre-computed square of SECS_PER_DAY, used to convert CP/day² → CP/sec² */
	const DAY_SQUARED = SECS_PER_DAY * SECS_PER_DAY; // 86400²

	// =========================================================================
	//  PREDICTION MODEL TUNING
	// =========================================================================

	/**
	 * The passive CP rate climbs while the player upgrades culture buildings
	 * (e.g. 108 → 293 CP/day over the first week). We estimate that growth from
	 * the production-rate history and project it forward as a bounded
	 * acceleration. These constants keep the trend honest:
	 */
	const TREND = {
		/** Only fit the slope over the most recent N days of rate history. */
		WINDOW_DAYS: 14,
		/**
		 * Cap the projected rate at this multiple of the current rate. The trend
		 * captures a near-term build-up spurt; it must not extrapolate a finite
		 * spurt into infinite growth on a long endgame horizon.
		 */
		MAX_GROWTH: 2.5,
	};

	// =========================================================================
	//  GAME DATA CONSTANTS
	// =========================================================================

	/** CP awarded per celebration completion (base values, multiply by speed) */
	const CEL_CAPS = { small: 500, large: 2000 };

	/**
	 * CP thresholds required for each village slot, keyed by server speed.
	 * Index = village number (0-based), value = cumulative CP needed.
	 */
	const CP_REQUIREMENTS = {
		1: [
			0, 2000, 8000, 20000, 39000, 65000, 99000, 141000, 191000, 251000, 319000,
			397000, 486000, 584000, 692000, 811000, 941000, 1082000, 1234000, 1397000,
			1572000, 1759000, 1957000, 2168000, 2391000, 2627000, 2874000, 3135000,
			3409000, 3695000, 3995000, 4308000, 4634000, 4974000, 5327000, 5695000,
			6076000, 6471000, 6881000, 7304000, 7742000, 8195000, 8662000, 9143000,
			9640000, 10151000, 10677000, 11219000, 11775000, 12347000,
		],
		2: [
			0, 800, 3900, 10000, 19400, 32400, 49300, 70300, 95500, 125300, 159600,
			198700, 242800, 291800, 346100, 405600, 470500, 540900, 616900, 698600,
			786100, 879400, 978700, 1084100, 1195600, 1313300, 1437200, 1567600,
			1704300, 1847600, 1997400, 2153900, 2317000, 2487000, 2663700, 2847400,
			3038000, 3235600, 3440300, 3652100, 3871000, 4097300, 4330800, 4571600,
			4819800, 5075500, 5338700, 5609400, 5887700, 6173600,
		],
		3: [
			0, 500, 2600, 6700, 12900, 21600, 32900, 46900, 63700, 83500, 106400,
			132500, 161900, 194600, 230700, 270400, 313700, 360600, 411300, 465700,
			524000, 586300, 652500, 722700, 797000, 875500, 958200, 1045000, 1136200,
			1231700, 1331600, 1435900, 1544700, 1658000, 1775800, 1898300, 2025300,
			2157100, 2293500, 2434700, 2580700, 2731500, 2887200, 3047700, 3213200,
			3383700, 3559100, 3739600, 3925100, 4115800,
		],
		5: [
			0, 300, 1600, 4000, 7800, 13000, 19700, 28100, 38200, 50100, 63800, 79500,
			97100, 116700, 138400, 162200, 188200, 216400, 246800, 279400, 314400,
			351800, 391500, 433600, 478200, 525300, 574900, 627000, 681700, 739000,
			799000, 861600, 926800, 994800, 1065500, 1139000, 1215200, 1294200,
			1376100, 1460800, 1548400, 1638900, 1732300, 1828600, 1927900, 2030200,
			2135500, 2243800, 2355100, 2469500,
		],
		10: [
			0, 200, 800, 2000, 3900, 6500, 9900, 14100, 19100, 25100, 31900, 39700,
			48600, 58400, 69200, 81100, 94100, 108200, 123400, 139700, 157200, 175900,
			195700, 216800, 239100, 262700, 287400, 313500, 340900, 369500, 399500,
			430800, 463400, 497400, 532700, 569500, 607600, 647100, 688100, 730400,
			774200, 819500, 866200, 914300, 964000, 1015100, 1067700, 1121900,
			1177500, 1234700,
		],
	};

	/** Small celebration duration in seconds at x1 speed, indexed by Town Hall level (1–20) */
	const SMALL_CEL_SECS = [
		0, // Lvl 0 (placeholder)
		86400, // Lvl 1:  24:00:00
		83290, // Lvl 2:  23:08:10
		80291, // Lvl 3:  22:18:11
		77401, // Lvl 4:  21:30:01
		74614, // Lvl 5:  20:43:34
		71928, // Lvl 6:  19:58:48
		69339, // Lvl 7:  19:15:39
		66843, // Lvl 8:  18:34:03
		64436, // Lvl 9:  17:53:56
		62117, // Lvl 10: 17:15:17
		59880, // Lvl 11: 16:38:00
		57725, // Lvl 12: 16:02:05
		55647, // Lvl 13: 15:27:27
		53643, // Lvl 14: 14:54:03
		51712, // Lvl 15: 14:21:52
		49850, // Lvl 16: 13:50:50
		48056, // Lvl 17: 13:20:56
		46326, // Lvl 18: 12:52:06
		44658, // Lvl 19: 12:24:18
		43050, // Lvl 20: 11:57:30
	];

	/** Large celebration duration in seconds at x1 speed (available from TH level 10+) */
	const LARGE_CEL_SECS = [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		0, // Levels 0–9: not available
		155291, // Lvl 10: 43:08:11
		149701, // Lvl 11: 41:35:01
		144312, // Lvl 12: 40:05:12
		139116, // Lvl 13: 38:38:36
		134108, // Lvl 14: 37:15:08
		129280, // Lvl 15: 35:54:40
		124626, // Lvl 16: 34:37:06
		120140, // Lvl 17: 33:22:20
		115815, // Lvl 18: 32:10:15
		111645, // Lvl 19: 31:00:45
		107626, // Lvl 20: 29:53:46
	];

	// =========================================================================
	//  NUMBER PARSING
	// =========================================================================

	/**
	 * Parse Travian's formatted numbers (supports "1.2k", "3,500", "1.5M", etc.)
	 * Strips invisible Unicode characters and handles locale-specific separators.
	 *
	 * @param {string} str - Raw text from the Travian DOM
	 * @returns {number} Parsed integer value, or 0 on failure
	 */
	function parseGameNumber(str) {
		if (!str) return 0;

		// Strip zero-width / bidirectional Unicode chars
		str = str.replace(/[\u200B-\u200D\uFEFF\u202A-\u202E]/g, "").trim();
		const lower = str.toLowerCase();
		const hasK = lower.includes("k");
		const hasM = lower.includes("m");
		let clean = lower.replace(/[^0-9,.\-]/g, "");

		if (hasK || hasM) {
			// Abbreviated: treat comma as decimal separator (European locale)
			clean = clean.replace(",", ".");
			let val = parseFloat(clean) || 0;
			if (hasK) val *= 1_000;
			if (hasM) val *= 1_000_000;
			return Math.round(val);
		}

		// Full number: strip all separators
		clean = clean.replace(/[.,]/g, "");
		return parseInt(clean, 10) || 0;
	}

	// =========================================================================
	//  HTML / JSON EXTRACTION
	// =========================================================================

	/**
	 * Extract the `progression.perDay` array from Travian's embedded JSON.
	 * This array contains historical daily CP production data points.
	 *
	 * @param {string} html - Full page HTML
	 * @returns {Array|null} Array of {day, culture_points} objects, or null
	 */
	function extractProgression(html) {
		const keyPattern = /"progression"\s*:\s*\{\s*"perDay"\s*:\s*/;
		const match = html.match(keyPattern);
		if (!match) return null;

		const startIdx = match.index + match[0].length;
		let balance = 0;
		let endIdx = startIdx;
		let foundStart = false;

		for (let i = startIdx; i < html.length; i++) {
			if (html[i] === "[") {
				balance++;
				foundStart = true;
			} else if (html[i] === "]") {
				balance--;
				if (foundStart && balance === 0) {
					endIdx = i + 1;
					break;
				}
			}
		}

		if (!foundStart || endIdx === startIdx) return null;
		try {
			return JSON.parse(html.substring(startIdx, endIdx));
		} catch {
			return null;
		}
	}

	// =========================================================================
	//  RATE-TREND ESTIMATION
	// =========================================================================

	/**
	 * Estimate how fast the passive production rate is climbing, from the
	 * historical daily-rate series (`progression.perDay`). Returns an
	 * acceleration in CP/second², always ≥ 0 (we only project upward growth —
	 * players don't usually demolish culture buildings).
	 *
	 * Each progression entry is `{ culture_points, day, date }` where
	 * `culture_points` is the *passive daily rate* on that day (NOT cumulative).
	 * We least-squares fit rate-vs-day over the recent window and convert the
	 * CP/day-per-day slope into CP/sec².
	 *
	 * @param {Array<{culture_points:number, day:number}>} progression
	 * @returns {number} Acceleration in CP/sec² (0 if no/insufficient/flat data)
	 */
	function computeRateSlope(progression) {
		if (!Array.isArray(progression)) return 0;
		const pts = progression
			.filter(
				(p) =>
					p &&
					typeof p.culture_points === "number" &&
					typeof p.day === "number",
			)
			.slice(-TREND.WINDOW_DAYS);
		if (pts.length < 3) return 0;

		const n = pts.length;
		let sx = 0, sy = 0, sxx = 0, sxy = 0;
		for (const p of pts) {
			sx += p.day;
			sy += p.culture_points;
			sxx += p.day * p.day;
			sxy += p.day * p.culture_points;
		}
		const denom = n * sxx - sx * sx;
		if (Math.abs(denom) < 1e-9) return 0;

		const slopePerDayPerDay = (n * sxy - sx * sy) / denom; // CP/day per day
		if (slopePerDayPerDay <= 0) return 0;
		return slopePerDayPerDay / DAY_SQUARED; // → CP/sec²
	}

	// =========================================================================
	//  PASSIVE-PRODUCTION KINEMATICS (constant accel, capped rate)
	// =========================================================================
	//
	// Passive CP grows as  rate(t) = min(v0 + a·t, vMax).  The rate ramps up
	// linearly (capturing the build-up spurt) until it hits vMax = MAX_GROWTH ×
	// current rate, then holds flat so a finite spurt can't extrapolate to
	// infinite endgame growth. These three helpers integrate / invert that
	// piecewise model.

	/** CP produced over `t` seconds, starting at velocity `v`. */
	function passiveGain(v, a, vMax, t) {
		if (t <= 0) return 0;
		if (a <= 0) return v * t;
		const tCap = (vMax - v) / a; // time until the rate cap is reached
		if (tCap <= 0) return vMax * t; // already at/above cap
		if (t <= tCap) return v * t + 0.5 * a * t * t;
		const gainToCap = v * tCap + 0.5 * a * tCap * tCap;
		return gainToCap + vMax * (t - tCap);
	}

	/** Seconds needed to produce `dist` CP, starting at velocity `v`. */
	function passiveTime(dist, v, a, vMax) {
		if (dist <= 0) return 0;
		if (a <= 0) return v > 0 ? dist / v : Infinity;
		const tCap = (vMax - v) / a;
		if (tCap <= 0) return vMax > 0 ? dist / vMax : Infinity;
		const gainToCap = v * tCap + 0.5 * a * tCap * tCap;
		if (dist <= gainToCap) return solveQuadratic(dist, v, a);
		return tCap + (dist - gainToCap) / vMax;
	}

	/** Velocity after `t` seconds, clamped to the cap. */
	function velAt(v, a, vMax, t) {
		if (a <= 0) return v;
		return Math.min(vMax, v + a * t);
	}

	/**
	 * CP awarded by one celebration completion (the verified in-game rule).
	 *   small → the holding village's daily production, capped at 500 × speed
	 *   large → the account's total daily production, capped at 2000 × speed
	 *
	 * @param {"small"|"large"} type
	 * @param {number} villageProd - holding village's daily CP (for small)
	 * @param {number} v - current account-wide passive rate (CP/sec, for large)
	 */
	function celebrationReward(type, villageProd, v, smallCap, largeCap) {
		if (type === "small") return Math.min(villageProd, smallCap);
		return Math.min(v * SECS_PER_DAY, largeCap);
	}

	// =========================================================================
	//  SETTLEMENT PREDICTION (single source of truth for all contexts)
	// =========================================================================

	/**
	 * Predict the time until the player reaches `target` cumulative CP.
	 *
	 * The model is fully deterministic — no state estimation, because the game
	 * already reports exact state:
	 *   CP(t) = totalCp + ∫ passiveRate(t) dt + Σ celebration rewards
	 * Passive production ramps via the bounded-accel kinematics above; each
	 * toggled celebration fires every `duration(TH,type)/speed` and contributes
	 * its (correct) reward.
	 *
	 * @param {Object}   p
	 * @param {number}   p.totalCp      - Current cumulative CP (`soFar`), exact
	 * @param {number}   p.passiveRate  - Current passive rate in CP/sec (perDay/86400)
	 * @param {number}  [p.passiveAccel]- Rate growth in CP/sec² (from computeRateSlope)
	 * @param {Array}    p.villages     - [{cpProduction, townHall, smallCel, largeCel, timerSeconds}]
	 * @param {number}   p.speed        - Server speed multiplier
	 * @param {number}   p.target       - Target cumulative CP threshold
	 * @param {number}  [p.dt]          - Seconds elapsed since the values were scraped
	 * @returns {{seconds:number, currentCp:number, ratePerDay:number, reached:boolean}}
	 *          `seconds` is Infinity if the target can never be reached.
	 */
	function predictSettlement(p) {
		const {
			totalCp = 0,
			passiveRate = 0,
			passiveAccel = 0,
			villages = [],
			speed = 1,
			target = 0,
			dt = 0,
		} = p;

		const accel = passiveAccel > 0 ? passiveAccel : 0;
		const vMax = passiveRate * TREND.MAX_GROWTH;
		const smallCap = CEL_CAPS.small * speed;
		const largeCap = CEL_CAPS.large * speed;

		// --- 1. Advance the scraped state forward to "now" ---
		let cp = totalCp + passiveGain(passiveRate, accel, vMax, dt);
		let v = velAt(passiveRate, accel, vMax, dt);

		// Build the celebration queue, replaying any completions that happened
		// during the elapsed dt so the live "now" CP includes them.
		const queue = [];
		for (const vi of villages) {
			const type = vi.smallCel ? "small" : vi.largeCel ? "large" : null;
			if (!type) continue;
			const duration = getCelebrationDuration(type, vi.townHall || 1, speed);
			if (duration <= 0) continue;

			let timeLeft = vi.timerSeconds > 0 ? vi.timerSeconds - dt : duration;
			while (timeLeft <= 0) {
				cp += celebrationReward(type, vi.cpProduction, v, smallCap, largeCap);
				timeLeft += duration;
			}
			// An in-game timer can span several back-to-back celebrations; fold it
			// down to the single soonest completion (the sim re-queues the rest).
			while (timeLeft > duration) timeLeft -= duration;
			queue.push({ at: timeLeft, type, duration, baseProd: vi.cpProduction });
		}

		const currentCp = cp;
		const ratePerDay = v * SECS_PER_DAY;

		if (target <= 0) return { seconds: 0, currentCp, ratePerDay, reached: false };
		if (cp >= target) return { seconds: 0, currentCp, ratePerDay, reached: true };

		// --- 2. Event-driven forward simulation ---
		queue.sort((a, b) => a.at - b.at);
		let simTime = 0;
		let iterations = 0;

		while (queue.length > 0 && iterations++ < 5000) {
			const ev = queue.shift();
			const stepDt = ev.at - simTime;
			if (stepDt < 0) {
				simTime = ev.at;
				continue;
			}

			const gain = passiveGain(v, accel, vMax, stepDt);
			if (cp + gain >= target) {
				simTime += passiveTime(target - cp, v, accel, vMax);
				return { seconds: simTime, currentCp, ratePerDay, reached: true };
			}

			cp += gain;
			v = velAt(v, accel, vMax, stepDt);
			simTime = ev.at;

			cp += celebrationReward(ev.type, ev.baseProd, v, smallCap, largeCap);
			if (cp >= target) {
				return { seconds: simTime, currentCp, ratePerDay, reached: true };
			}

			queue.push({
				at: simTime + ev.duration,
				type: ev.type,
				duration: ev.duration,
				baseProd: ev.baseProd,
			});
			queue.sort((a, b) => a.at - b.at);
		}

		// --- 3. Solve the remaining passive distance after the event horizon ---
		const t = passiveTime(target - cp, v, accel, vMax);
		if (!isFinite(t)) return { seconds: Infinity, currentCp, ratePerDay, reached: false };
		return { seconds: simTime + t, currentCp, ratePerDay, reached: true };
	}

	// =========================================================================
	//  QUADRATIC SOLVER (replaces Newton-Raphson on 4th-order polynomial)
	// =========================================================================

	/**
	 * Solve time to accumulate `distance` CP given constant acceleration.
	 *
	 *   distance = v·t + ½·a·t²
	 *
	 * @param {number} distance - CP still needed
	 * @param {number} v - Current velocity (CP/sec)
	 * @param {number} a - Current acceleration (CP/sec²)
	 * @returns {number} Seconds until target reached (99999999 if unsolvable)
	 */
	function solveQuadratic(distance, v, a) {
		const UNREACHABLE = 99_999_999;
		if (distance <= 0) return 0;

		// Linear case: no acceleration
		if (Math.abs(a) < 1e-15) {
			return v > 0 ? distance / v : UNREACHABLE;
		}

		// Quadratic: ½·a·t² + v·t - distance = 0
		const discriminant = v * v + 2 * a * distance;
		if (discriminant < 0) return UNREACHABLE;

		const sqrtDisc = Math.sqrt(discriminant);
		// Take the positive root
		const t1 = (-v + sqrtDisc) / a;
		const t2 = (-v - sqrtDisc) / a;

		// Return smallest positive root
		const candidates = [t1, t2].filter(t => t > 0);
		return candidates.length > 0 ? Math.min(...candidates) : UNREACHABLE;
	}

	// =========================================================================
	//  FORMATTING HELPERS
	// =========================================================================

	/**
	 * Format seconds into "Xd Yh Zm" display string.
	 * @param {number} totalSeconds
	 * @returns {string}
	 */
	function formatDuration(totalSeconds) {
		if (totalSeconds <= 0) return "0d 0h 0m";
		const d = Math.floor(totalSeconds / SECS_PER_DAY);
		const h = Math.floor((totalSeconds % SECS_PER_DAY) / SECS_PER_HOUR);
		const m = Math.floor((totalSeconds % SECS_PER_HOUR) / SECS_PER_MIN);
		return `${d}d ${h}h ${m}m`;
	}

	/**
	 * Format seconds into "HH:MM:SS" for clipboard copy.
	 * @param {number} totalSeconds
	 * @returns {string}
	 */
	function formatHMS(totalSeconds) {
		const h = Math.floor(totalSeconds / SECS_PER_HOUR)
			.toString()
			.padStart(2, "0");
		const m = Math.floor((totalSeconds % SECS_PER_HOUR) / SECS_PER_MIN)
			.toString()
			.padStart(2, "0");
		const s = (totalSeconds % SECS_PER_MIN).toString().padStart(2, "0");
		return `${h}:${m}:${s}`;
	}

	/**
	 * Get the celebration duration in seconds for a given TH level, type, and speed.
	 * @param {"small"|"large"} type
	 * @param {number} thLevel - Town Hall level (1–20)
	 * @param {number} speed   - Server speed multiplier
	 * @returns {number} Duration in seconds
	 */
	function getCelebrationDuration(type, thLevel, speed) {
		const table = type === "large" ? LARGE_CEL_SECS : SMALL_CEL_SECS;
		const fallback = type === "large" ? 259200 : SECS_PER_DAY;
		return (table[thLevel] || fallback) / speed;
	}

	/**
	 * Build the storage key for a given server URL.
	 * @param {string} serverUrl - Server origin (e.g., "https://ts1.travian.com")
	 * @returns {string}
	 */
	function storageKey(serverUrl) {
		return `tsp_data_${serverUrl}`;
	}

	/**
	 * Build the per-server target CP storage key.
	 * @param {string} serverUrl - Server origin
	 * @returns {string}
	 */
	function targetCpKey(serverUrl) {
		return `tsp_target_cp_${serverUrl}`;
	}

	// =========================================================================
	//  PUBLIC API
	// =========================================================================

	return {
		// Browser API
		api,

		// Time constants
		SECS_PER_DAY,

		// Game data
		CP_REQUIREMENTS,

		// Parsing
		parseGameNumber,
		extractProgression,

		// Prediction
		computeRateSlope,
		predictSettlement,

		// Formatting
		formatDuration,
		formatHMS,
		getCelebrationDuration,

		// Storage
		storageKey,
		targetCpKey,
	};
})();
