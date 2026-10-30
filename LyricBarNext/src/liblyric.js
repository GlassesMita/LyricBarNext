// LyricBarNext —— 网易云音乐 3.x 软件内词栏插件
// Copyright (C) 2026 Plana
//
// 本程序为自由软件：你可以在 GPL-3.0（或更高版本，由你选择）许可下
// 重新分发和/或修改它。完整许可文本见仓库根目录 LICENSE。
// 部分代码改编自 MIT 许可的第三方项目（详见 README「来源与鸣谢」），
// 其版权归原作者所有，此处随本程序以 GPL-3.0 重新分发。
// 移植自 solstice23/liblyric（MIT License），来源：SUlTlUS/refined-now-playing-netease-next src/liblyric/index.ts
// TypeScript 类型标注剥离版，解析逻辑逐行保持一致。
// 支持 LRC 逐行歌词 / 翻译 / 罗马音对齐，以及网易云 YRC 逐字歌词解析。

const findLast = (items, predicate) => {
	for (let i = items.length - 1; i >= 0; i--) {
		if (predicate(items[i], i, items)) {
			return items[i];
		}
	}
	return null;
};

export const PURE_MUSIC_LYRIC_LINE = [
	{
		time: 0,
		duration: 5940000,
		originalLyric: "纯音乐，请欣赏",
	},
];

const simularityCache = {};
function calcSimularity(a, b) {
	if (typeof (a) === "undefined") a = "";
	if (typeof (b) === "undefined") b = "";
	const key = `${a}::${b}`;
	if (simularityCache[key] !== undefined) {
		return simularityCache[key];
	}
	const m = a.length;
	const n = b.length;
	const d = [];
	for (let i = 0; i <= m; i++) {
		d[i] = [];
		d[i][0] = i;
	}
	for (let j = 0; j <= n; j++) {
		d[0][j] = j;
	}
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			if (a[i - 1] === b[j - 1]) {
				d[i][j] = d[i - 1][j - 1];
			} else {
				d[i][j] = Math.min(d[i - 1][j - 1] + 1, d[i][j - 1] + 1, d[i - 1][j] + 1);
			}
		}
	}
	return d[m][n];
}

const isEnglishSentense = (str) => {
	if (str.replace(/[\p{P}\p{S}]/gu, '').match(/^[\s\w\u00C0-\u024F]+$/u)) {
		return true;
	}
	return false;
};
const replaceChineseSymbolsToEnglish = (str) => {
	return str.replace(/[‘’′]/g, '\'')
		.replace(/[“”″]/g, '"')
		.replace(/（/g, '(')
		.replace(/）/g, ')')
		.replace(/，/g, ',')
		.replace(/！/g, '!')
		.replace(/？/g, '?')
		.replace(/：/g, ':')
		.replace(/；/g, ';');
};

export function parseLyric(
	original,
	translated = "",
	roman = "",
	dynamic = "",
) {
	if (dynamic.trim().length === 0) {
		const result = parsePureLyric(original).map((v) => ({
			time: v.time,
			originalLyric: v.lyric,
			duration: 0,
			...(v.unsynced ? { unsynced: true } : {}),
		}));

		parsePureLyric(translated).forEach((line) => {
			const target = result.find((v) => v.time === line.time);
			if (target) {
				target.translatedLyric = line.lyric;
			}
		});

		parsePureLyric(roman).forEach((line) => {
			const target = result.find((v) => v.time === line.time);
			if (target) {
				target.romanLyric = line.lyric;
			}
		});

		result.sort((a, b) => a.time - b.time);

		const processed = processLyric(result);

		for (let i = 0; i < processed.length; i++) {
			if (i < processed.length - 1) {
				processed[i].duration = processed[i + 1].time - processed[i].time;
			}
		}

		return processLyric(result);
	} else {
		const processed = parsePureDynamicLyric(dynamic);

		const originalLyrics = parsePureLyric(original);

		const attachOriginalLyric = (lyric) => {
			let attachMatchingMode = 'equal';

			const lyricTimeSet = new Set(lyric.map((v) => v.time));
			const originalLyricTimeSet = new Set(originalLyrics.map((v) => v.time));
			const intersection = new Set([...lyricTimeSet].filter((v) => originalLyricTimeSet.has(v)));
			if (intersection.size / lyricTimeSet.size < 0.1) {
				attachMatchingMode = 'closest';
			}

			originalLyrics.forEach((line) => {
				let target = null;
				if (attachMatchingMode === 'equal') {
					target = findLast(lyric, (v) => Math.abs(v.time - line.time) < 20);
				} else {
					lyric.forEach((v) => {
						if (target) {
							if (
								Math.abs(target.time - line.time) > Math.abs(v.time - line.time)
							) {
								target = v;
							}
						} else {
							target = v;
						}
					});
				}

				if (target) {
					target.originalLyric = target.originalLyric || "";
					if (target.originalLyric.length > 0) {
						target.originalLyric += " ";
					}
					target.originalLyric += line.lyric;
				}
			});
			return lyric;
		};
		const attachLyricToDynamic = (lyric, field) => {
			lyric.forEach((line) => {
				let targetIndex = 0;
				processed.forEach((v, index) => {
					if (
						Math.abs(processed[targetIndex].time - line.time) > Math.abs(v.time - line.time)
					) {
						targetIndex = index;
					}
				});
				let sequence = [targetIndex];
				for (let offset = 1; offset <= 5; offset++) {
					if (targetIndex - offset >= 0) sequence.push(targetIndex - offset);
					if (targetIndex + offset < processed.length) sequence.push(targetIndex + offset);
				}

				sequence = sequence.reverse();

				let minWeight = 1000000000;

				for (let index of sequence) {
					const v = processed[index];
					const similarity = calcSimularity(line.originalLyric, v.originalLyric);
					const weight = similarity * 1000 + (v[field] ? 1 : 0);
					if (weight < minWeight) {
						minWeight = weight;
						targetIndex = index;
					}
				}

				const target = processed[targetIndex];

				target[field] = target[field] || "";
				if (target[field].length > 0) {
					target[field] += " ";
				}
				target[field] += line.lyric;
			});
		};

		const translatedParsed = attachOriginalLyric(parsePureLyric(translated));
		const romanParsed = attachOriginalLyric(parsePureLyric(roman));
		const rawParsed = attachOriginalLyric(parsePureLyric(original));

		attachLyricToDynamic(translatedParsed, 'translatedLyric');
		attachLyricToDynamic(romanParsed, 'romanLyric');
		attachLyricToDynamic(rawParsed, 'rawLyric');

		// 插入空行
		for (let i = 0; i < processed.length; i++) {
			const thisLine = processed[i];
			const nextLine = processed[i + 1];
			if (
				thisLine &&
				nextLine &&
				thisLine.originalLyric.trim().length > 0 &&
				nextLine.originalLyric.trim().length > 0 &&
				thisLine.duration > 0
			) {
				const thisLineEndTime =
					(thisLine?.dynamicLyricTime || thisLine.time) + thisLine.duration;
				let nextLineStartTime = nextLine.time;
				if (
					nextLine.dynamicLyricTime &&
					nextLineStartTime > nextLine.dynamicLyricTime
				) {
					nextLineStartTime = nextLine.dynamicLyricTime;
				}
				if (nextLineStartTime - thisLineEndTime >= 5000) {
					processed.splice(i + 1, 0, {
						time: thisLineEndTime,
						originalLyric: "",
						duration: nextLineStartTime - thisLineEndTime,
					});
				}
			}
		}

		// 同步原文空格到逐字
		for (let i = 0; i < processed.length; i++) {
			const thisLine = processed[i];
			let raw = thisLine.rawLyric?.trim() ?? "";
			const dynamicWords = thisLine.dynamicLyric || [];

			for (let j = 0; j < dynamicWords.length; j++) {
				const thisWord = dynamicWords[j].word.trimEnd();
				if (raw.startsWith(thisWord)) {
					raw = raw.substring(thisWord.length);
				} else {
					break;
				}
				const match = raw.match(/^\s+/);
				if (match) {
					raw = raw.substring(match[0].length);
					if (!dynamicWords[j].word.match(/\s$/)) {
						dynamicWords[j].word += " ";
					}
				}
			}
		}

		// 标记 CJK 字符和是否空格结尾
		const CJKRegex = /([\p{Unified_Ideograph}|\u3040-\u309F|\u30A0-\u30FF])/gu;
		for (let i = 0; i < processed.length; i++) {
			const thisLine = processed[i];
			const dynamicWords = thisLine.dynamicLyric || [];
			for (let j = 0; j < dynamicWords.length; j++) {
				if (dynamicWords[j]?.word?.match(CJKRegex)) {
					dynamicWords[j].isCJK = true;
				}
				if (dynamicWords[j]?.word?.match(/\s$/)) {
					dynamicWords[j].endsWithSpace = true;
				}
			}
		}

		// 标记尾部拖长音
		for (let i = 0; i < processed.length; i++) {
			const thisLine = processed[i];
			const dynamicWords = thisLine.dynamicLyric || [];

			const searchIndexes = [-1];
			for (let j = 0; j < dynamicWords.length - 1; j++) {
				if (dynamicWords[j]?.endsWithSpace || dynamicWords[j]?.word?.match(/[\,\.\，\。\!\?\？\、\；\：\…\—\~\～\·\‘\’\“\”\ﾞ]/)) {
					if (!dynamicWords[j]?.word?.match(/[a-zA-Z]+(\'\‘\’)*[a-zA-Z]*/)) {
						searchIndexes.push(j);
					}
				}
			}
			searchIndexes.push(dynamicWords.length - 1);

			for (let j = searchIndexes.length - 1; j >= 1; j--) {
				let targetIndex = null;
				for (let k = searchIndexes[j]; k > searchIndexes[j - 1]; k--) {
					const word = dynamicWords[k].word.trim();
					// special chars and punctuations
					if (word.match(/[\p{P}\p{S}]/gu)) {
						continue;
					}
					// space
					if (word.match(/^\s*$/)) {
						continue;
					}
					targetIndex = k;
					break;
				}
				if (targetIndex === null) {
					continue;
				}
				const target = dynamicWords[targetIndex];
				if (target.duration >= 1000) {
					target.trailing = true;
				}
			}
		}

		return processLyric(processed);
	}
}

const yrcLineRegexp = /^\[(?<time>[0-9]+),(?<duration>[0-9]+)\](?<line>.*)/;
const yrcWordTimeRegexp =
	/^\((?<time>[0-9]+),(?<duration>[0-9]+),(?<flag>[0-9]+)\)(?<word>[^\(]*)/;
const timeRegexp = /^\[((?<min>[0-9]+):)?(?<sec>[0-9]+([\.:]([0-9]+))?)\]/;
const metaTimeRegexp = /^\[((?<min>[0-9]+):)?(?<sec>[0-9]+([\.:]([0-9]+))?)\-(?<discriminator>[0-9]+)\]/; //[00:00.00-1] 作词 : xxx
export function parsePureLyric(lyric) {
	const result = [];

	for (const line of lyric.split("\n")) {
		let text = line.trim();
		const timestamps = [];
		while (true) {
			const matches = text.match(timeRegexp);
			if (matches) {
				const min = Number(matches.groups?.min || "0");
				const sec = Number(matches.groups?.sec.replace(/:/, ".") || "0");
				timestamps.push(Math.floor((min * 60 + sec) * 1000));
				text =
					text.slice(0, matches.index) +
					text.slice((matches.index || 0) + matches[0].length);
				text = text.trim();
			} else {
				break;
			}
		}
		text = text.trim();
		for (const time of timestamps) {
			result.push({
				time,
				lyric: text,
			});
		}
	}

	if (result.length === 0 && lyric.trim().length > 0) {
		return parseUnsyncedLyrics(lyric);
	}

	return result.sort((a, b) => a.time - b.time);
}

export function parseUnsyncedLyrics(lyric) {
	const result = [];
	for (const line of lyric.split("\n")) {
		const text = line.trim();
		if (!text.length) {
			continue;
		}
		if (text.match(metaTimeRegexp)) {
			continue;
		}
		result.push({
			time: 999999999,
			lyric: text,
			unsynced: true,
		});
	}
	// insert to the head
	if (result.length) {
		result.unshift({
			time: 0,
			lyric: '歌词不支持滚动',
			unsynced: true,
		});
	}
	return result;
}

export function parsePureDynamicLyric(lyric) {
	const result = [];
	// 解析逐词歌词
	for (const line of lyric.trim().split("\n")) {
		let tmp = line.trim();
		const lineMatches = tmp.match(yrcLineRegexp);
		if (lineMatches) {
			const time = parseInt(lineMatches.groups?.time || "0");
			const duration = parseInt(lineMatches.groups?.duration || "0");
			tmp = lineMatches.groups?.line || "";
			const words = [];
			while (tmp.length > 0) {
				const wordMatches = tmp.match(yrcWordTimeRegexp);
				if (wordMatches) {
					const wordTime = parseInt(wordMatches.groups?.time || "0");
					const wordDuration = parseInt(wordMatches.groups?.duration || "0");
					const flag = parseInt(wordMatches.groups?.flag || "0");
					const word = wordMatches.groups?.word.trimStart();
					const splitedWords = word
						?.split(/\s+/)
						.filter((v) => v.trim().length > 0); // 有些歌词一个单词还是一个句子的就离谱
					if (splitedWords) {
						const splitedDuration = wordDuration / splitedWords.length;
						splitedWords.forEach((subWord, i) => {
							if (i === splitedWords.length - 1) {
								if (/\s/.test((word ?? '')[(word ?? '').length - 1])) {
									words.push({
										time: wordTime + i * splitedDuration,
										duration: splitedDuration,
										flag,
										word: `${subWord.trimStart()} `,
									});
								} else {
									words.push({
										time: wordTime + i * splitedDuration,
										duration: splitedDuration,
										flag,
										word: subWord.trimStart(),
									});
								}
							} else if (i === 0) {
								if (/\s/.test((word ?? '')[0])) {
									words.push({
										time: wordTime + i * splitedDuration,
										duration: splitedDuration,
										flag,
										word: ` ${subWord.trimStart()}`,
									});
								} else {
									words.push({
										time: wordTime + i * splitedDuration,
										duration: splitedDuration,
										flag,
										word: subWord.trimStart(),
									});
								}
							} else {
								words.push({
									time: wordTime + i * splitedDuration,
									duration: splitedDuration,
									flag,
									word: `${subWord.trimStart()} `,
								});
							}
						});
					}
					tmp = tmp.slice(wordMatches.index || 0 + wordMatches[0].length);
				} else {
					break;
				}
			}
			const parsedLine = {
				time,
				duration,
				originalLyric: words.map((v) => v.word).join(""),
				dynamicLyric: words,
				dynamicLyricTime: time,
			};
			result.push(parsedLine);
		}
	}
	return result.sort((a, b) => a.time - b.time);
}

// 处理歌词，去除一些太短的空格间曲段，并为前摇太长的歌曲加前导空格
export function processLyric(lyric) {
	if (
		lyric.length > 0 &&
		lyric[lyric.length - 1].time === 5940000 &&
		lyric[lyric.length - 1].duration === 0
	) {
		// 纯音乐，请欣赏
		return PURE_MUSIC_LYRIC_LINE;
	}

	const result = [];

	let isSpace = false;
	lyric.forEach((thisLyric, i) => {
		if (thisLyric.originalLyric.trim().length === 0) {
			const nextLyric = lyric[i + 1];
			if (nextLyric && nextLyric.time - thisLyric.time > 5000 && !isSpace) {
				result.push(thisLyric);
				isSpace = true;
			}
		} else {
			isSpace = false;
			result.push(thisLyric);
		}
	});

	while (result[0]?.originalLyric.length === 0) {
		result.shift();
	}

	if (result[0]?.time > 5000) {
		result.unshift({
			time: 500,
			duration: result[0]?.time - 500,
			originalLyric: "",
		});
	}

	// 在英文句子中转化中文引号到英文分割号，中文标点到英文标点
	for (let i = 0; i < result.length; i++) {
		const thisLine = result[i];
		if (!isEnglishSentense(thisLine?.originalLyric)) {
			continue;
		}
		if (thisLine?.dynamicLyric) {
			for (let j = 0; j < thisLine.dynamicLyric.length; j++) {
				thisLine.dynamicLyric[j].word = replaceChineseSymbolsToEnglish(thisLine.dynamicLyric[j].word);
			}
		}
		if (thisLine?.originalLyric) {
			thisLine.originalLyric = replaceChineseSymbolsToEnglish(thisLine.originalLyric);
		}
	}

	return result;
}
