require("source-map-support").install();

import { Configuration, OpenAIApi } from "openai";

const CLUSTER_SIZE = 20;

const arFilterOptionsMechanics = [
  {
    value: "action",
    selector:
      "[value='Real-Time'], [value='Real-time'], [value='Action / Dexterity'], [value='Flicking'], [value='Stacking and Balancing']",
  },
  {
    value: "areaControl",
    selector: "[value='Area Majority / Influence']",
  },
  {
    value: "auction",
    selector:
      "[value='Auction / Bidding'], [value='Auction: Dutch Priority'], [value='Auction: English'], [value='Turn Order: Auction']",
  },
  {
    value: "cards",
    selector: "[value='Card Game']",
  },
  {
    value: "deckBuilding",
    selector:
      "[value='Deck, Bag, and Pool Building'], [value='Deck Construction']",
  },
  {
    value: "deduction",
    selector: "[value='Deduction'], [value='Pattern Recognition']",
  },
  {
    value: "drafting",
    selector:
      "[value='Closed Drafting'], [value='Open Drafting'], [value*='Dice Drafting']",
  },
  {
    value: "dungeonCrawler",
    selector: "[value='Category: Dungeon Crawler']",
  },
  {
    value: "networks",
    selector: "[value='Network and Route Building'], [value='Connections']",
  },
  {
    value: "party",
    selector: "[value='Party Game']",
  },
  {
    value: "rollAndWrite",
    selector:
      "[value='Mechanism: Roll-and-Write'], [value='Mechanism: Flip-and-Write']",
  },
  {
    value: "storytelling",
    selector: "[value='Storytelling'], [value='Role Playing']",
  },
  {
    value: "tilePlacement",
    selector:
      "[value='Pattern Building'], [value='Tile Placement'], [value='Grid Coverage']",
  },
  {
    value: "trading",
    selector: "[value='Trading'], [value='Negotiation']",
  },
  {
    value: "words",
    selector: "[value='Word Game']",
  },
  {
    value: "workerPlacement",
    selector: "[value*='Worker Placement']",
  },
];

const arFilterOptionsThemes = [
  {
    value: "adventure",
    selector: "[value='Adventure'], [value='Exploration']",
  },
  {
    value: "oldHistory",
    selector: "[value='Ancient'], [value='Medieval']",
  },
  {
    value: "animals",
    selector:
      "[value='Animals'], [value='Environmental'], [value='Prehistoric'], [value='Farming'], [value='Theme: Nature'], [value='Theme: Trees and Forests']",
  },
  {
    value: "arts",
    selector:
      "[value='Theme: Art'], [value='Theme: Fine Art and Art Museums'], [value='Theme: Painting / Paintings'], [value='Theme: Art style – Art Deco'], [value='Theme: Sewing / Knitting / Cloth-Making'], [value='Theme: Photography'], [value='Theme: Construction']",
  },
  {
    value: "economy-infrastructure",
    selector:
      "[value='Economic'], [value='City Building'], [value='Industry / Manufacturing'], [value='Civilization']",
  },
  {
    value: "fantasy",
    selector:
      "[value='Fantasy'], [value='Mythology'], [value='Theme: Superheroes']",
  },
  {
    value: "horror",
    selector: "[value='Horror'], [value='Zombies']",
  },
  {
    value: "murder",
    selector: "[value='Murder / Mystery'], [value='Theme: Mystery / Crime']",
  },
  {
    value: "politics",
    selector: "[value='Political'], [value='Spies / Secret Agents']",
  },
  {
    value: "newHistory",
    selector:
      "[value='Renaissance'], [value='Age of Reason'], [value='Napoleonic'], [value='Post-Napoleonic'], [value='American West']",
  },
  {
    value: "science",
    selector:
      "[value='Medical'], [value='Theme: Science'], [value='Theme: Alchemy'], [value='Theme: Mad Science / Mad Scientist']",
  },
  {
    value: "scifi",
    selector: "[value='Science Fiction'], [value='Space Exploration']",
  },
  {
    value: "nautical",
    selector: "[value='Nautical'], [value='Pirates']",
  },
  {
    value: "trains",
    selector: "[value='Racing'], [value='Trains'], [value='Aviation / Flight']",
  },
  {
    value: "war",
    selector:
      "[type='boardgamecategory'][value*='War'], [value='Fighting'], [value='Pike and Shot']",
  },
];

document.querySelector("#submit").addEventListener("click", () => {
  try {
    const formInput = (function readUserInputFromForm() {
      const input = {
        isWantedTranslate: document.querySelector("#translate").checked,
        isWantedChatGpt: document.querySelector("#chatgpt").checked,
        nameCollection: document.querySelector("#nameCollection").value,
        minRating: document.querySelector("#minRating").value,
        maxPlayerCount: +document.querySelector("#maxPlayerCount").value,
        isWantedInventoryLocation: document.querySelector("#inventory-location")
          .checked,
      };
      if (input.isWantedTranslate) {
        translate.engine = "deepl";
        translate.key = document.querySelector("#deeplApiKey").value;
        if (!translate.key) {
          console.warn(
            "You must provide a deepl api key if you want the descriptions of the games to be translated"
          );
          throw new Error();
        }
      }
      if (input.isWantedChatGpt) {
        const apiKey = document.querySelector("#chatGptApiKey").value;
        if (!apiKey) {
          console.warn(
            "You must provide an OpenAI api key if you want to use ChatGPT to generate data about the conflict level of the games"
          );
          throw new Error();
        }
        const configurationChatGPT = new Configuration({ apiKey });
        input.openaiInstance = new OpenAIApi(configurationChatGPT);
        input.chatGptModel = document.querySelector("#chatGptModel").value;
      }

      if (!input.nameCollection) {
        console.warn(
          "You must provide the name of a BoardGameGeek user to get the board game data for its collection."
        );
        throw new Error();
      }

      if (!input.maxPlayerCount) {
        console.warn(
          "You must provide the maximum number of players for which it shall be indicated whether the game is recommended for so many players."
        );
        throw new Error();
      }
      return input;
    })();

    (async function getXmlCollection(formInput) {
      if (!formInput.isWantedInventoryLocation) {
        const apiResponse = await fetch(
          `https://boardgamegeek.com/xmlapi2/collection\
    ?username=${formInput.nameCollection}\
    ${formInput.minRating ? `&minbggrating=${formInput.minRating}` : ""}\
    &type=boardgame\
    &excludesubtype=boardgameexpansion\
    &own=1\
    &version=1\
    &stats=1`
        );

        if (apiResponse.status === 202) {
          console.log(
            "Received status 202 while trying to get collection. Retrying in 5 seconds..."
          );
          await new Promise((resolve) => setTimeout(resolve, 5000));
          return getXmlCollection(formInput); // Recursive call
        }
        if (apiResponse.ok) {
          const strCollection = await apiResponse.text();
          const parser = new DOMParser();
          const xmlCollection = parser.parseFromString(
            strCollection,
            "application/xml"
          );
          if (xmlCollection === "error") {
            console.log("Error while parsing collection data to XML");
            throw new Error();
          } else processXmlCollection(xmlCollection, formInput);
        }
      } else {
        function isSafari() {
          return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        }
        document.querySelector(
          "#container-textarea-inventory-location"
        ).style.display = "block";
        document.querySelector("form").style.display = "none";

        const linkForUser = `${
          isSafari() ? "" : "view-source:"
        }https://boardgamegeek.com/xmlapi2/collection?username=${
          formInput.nameCollection
        }${
          formInput.minRating ? `&minbggrating=${formInput.minRating}` : ""
        }&type=boardgame&excludesubtype=boardgameexpansion&own=1&version=1&stats=1&showprivate=1`;

        document.querySelector("#link-for-manual-api-access").innerHTML =
          linkForUser;

        document
          .querySelector("#submit-manual-xml-inventory-location")
          .addEventListener("click", () => {
            const inputTextarea = document.querySelector("textarea").value;
            const parser = new DOMParser();

            const xmlCollection = parser.parseFromString(
              inputTextarea.trim(),
              "application/xml"
            );
            const parserError = xmlCollection.querySelector("parsererror");
            if (parserError) {
              console.error(
                "Error while parsing collection data to XML. The text you entered is probably not valid XML. Please try again."
              );
              console.error(e);
              throw new Error(parserError.textContent);
            }
            document.querySelector("form").style.display = "block";
            document.querySelector(
              "#container-textarea-inventory-location"
            ).style.display = "none";
            processXmlCollection(xmlCollection, formInput);
          });
      }
    })(formInput);
  } catch {
    console.error("Program stopped");
    return;
  }
});

async function processXmlCollection(xmlCollection, formInput) {
  const arGamesBasicDataAndVersionData =
    (function getBasicDataAndVersionDataAboutGamesFromCollection(
      xmlCollection,
      formInput
    ) {
      const arGamesBasicData = [];
      const nlAllGamesInCollection = xmlCollection.querySelectorAll(
        "item[subtype='boardgame']"
      );
      nlAllGamesInCollection.forEach((nodeGame) => {
        const game = {
          name: nodeGame.querySelector("name").textContent,
          id: +nodeGame.getAttribute("objectid"),
          geekRating: +nodeGame
            .querySelector("bayesaverage")
            .getAttribute("value"),
          arLanguages: nodeGame.querySelector("version")
            ? Array.from(nodeGame.querySelectorAll("[type='language']")).map(
                (nodeLanguage) => nodeLanguage.getAttribute("value")
              )
            : null,
          thumbnail:
            (nodeGame.querySelector("version thumbnail")?.textContent ??
              nodeGame.querySelector("thumbnail")?.textContent) ||
            "No image",
        };
        if (formInput.isWantedInventoryLocation)
          game.filterValues = {
            inventoryLocation: nodeGame
              .querySelector("privateinfo")
              ?.getAttribute("inventorylocation"),
          };

        // Filter out duplicates
        if (arGamesBasicData.every((obj) => obj.id !== game.id))
          arGamesBasicData.push(game);
      });
      return arGamesBasicData.sort((a, b) => b.geekRating - a.geekRating);
    })(xmlCollection, formInput);

  const arGamesDetailedData = await (async function getDetailedDataForGames(
    arGamesBasicDataAndVersionData,
    formInput
  ) {
    const arAllIds = arGamesBasicDataAndVersionData.map((obj) => obj.id);
    const arGameIdClusters = [];
    for (let i = 0; i < arAllIds.length / CLUSTER_SIZE; i++) {
      arGameIdClusters.push(
        arAllIds.slice(i * CLUSTER_SIZE, (i + 1) * CLUSTER_SIZE).join(",")
      );
    }
    let arGamesDetailedData = [];

    for (let i = 0; i < arGameIdClusters.length; i++) {
      // Must use for-loop instead of forEach, because forEach does not handle async well
      const xmlAllGamesOfCluster =
        await (async function getXmlDataForAllGamesInCluster(strIdCluster) {
          const apiResponse = await fetch(
            `https://boardgamegeek.com/xmlapi2/thing?id=${strIdCluster}&stats=1`
          );
          if (apiResponse.status === 202) {
            console.log(
              "Received status 202 while trying to get xml for cluster of games. Retrying in 5 seconds..."
            );
            await new Promise((resolve) => setTimeout(resolve, 5000));
            return getXmlDataForAllGamesInCluster(strIdCluster);
          }

          if (apiResponse.ok) {
            const strAllGamesOfCluster = await apiResponse.text();
            const parser = new DOMParser();
            const xmlAllGamesOfCluster = parser.parseFromString(
              strAllGamesOfCluster,
              "application/xml"
            );
            if (xmlAllGamesOfCluster === "error") {
              console.warn(
                "Error while trying to parse data of game cluster to xml"
              );
              console.warn(`Affected cluster: ${strIdCluster}`);
              throw new Error();
            } else return xmlAllGamesOfCluster;
          }
        })(arGameIdClusters[i]);
      const nlAllGamesOfCluster = xmlAllGamesOfCluster.querySelectorAll("item");
      for (let j = 0; j < nlAllGamesOfCluster.length; j++) {
        // Must use for-loop instead of forEach, because forEach does not handle async well
        const xmlGame = nlAllGamesOfCluster[j];
        let game = arGamesBasicDataAndVersionData[i * CLUSTER_SIZE + j];
        // Extract the data from the xml and interpretate it in a way that the BoardGame-O-Matic can later understand it
        // Assign each interpretation result to the game object
        game.year =
          +xmlGame.querySelector("yearpublished")?.getAttribute("value") ?? "";

        game.questionValues = (function getValuesForBoardGameOMaticQuestions(
          xmlGame,
          game
        ) {
          function getReleaseYearGroup(year) {
            if (!year) return 99;
            const currentYear = new Date().getFullYear();
            if (currentYear - year <= 2) return 2;
            else if (currentYear - year <= 5) return 1;
            else if (currentYear - year <= 10) return 0;
            else if (currentYear - year <= 20) return -1;
            else return -2;
          }
          function getPlayTimeGroup(xmlGame) {
            const playTime =
              +xmlGame.querySelector("maxplaytime").getAttribute("value") *
                1.25 ?? null; // Official max time is multiplied by 1.25 to get more realistic play time
            if (!playTime)
              return 99; // In the Boardgame-O-Matic, 99 means "Skip"
            else if (playTime < 45) return 2;
            else if (playTime < 90) return 1;
            else if (playTime < 120) return 0;
            else if (playTime < 180) return -1;
            else return -2;
          }
          function getDifficultyGroup(xmlGame) {
            const difficulty =
              +xmlGame.querySelector("averageweight").getAttribute("value") ??
              null;
            if (!difficulty) return 99;
            else if (difficulty < 1.6) return 2;
            else if (difficulty < 2.25) return 1;
            else if (difficulty < 3.0) return 0;
            else if (difficulty < 3.5) return -1;
            else return -2;

            // // Alternative version:
            // if (!difficulty) return 99;
            // else if (difficulty < 1.5) return 2;
            // else if (difficulty < 2) return 1;
            // else if (difficulty < 2.75) return 0;
            // else if (difficulty < 3.5) return -1;
            // else return -2;
          }
          function getLanguageDependenceGroup(xmlGame) {
            const poll = xmlGame.querySelector("[title='Language Dependence']");
            if (+poll.getAttribute("totalvotes") === 0) return 99;
            const arResults = [];
            Array.from(poll.querySelectorAll("result")).forEach(
              (option, index) => {
                arResults.push({
                  value: 2 - index,
                  votes: +option.getAttribute("numvotes"),
                });
              }
            );
            const topVotedResult = arResults.reduce((max, obj) => {
              return obj.votes > max.votes ? obj : max;
            }, arResults[0]);
            return topVotedResult.value;
          }
          const questionValues = {};
          questionValues.yearGrouped = getReleaseYearGroup(game.year);
          questionValues.playTime = getPlayTimeGroup(xmlGame);
          questionValues.difficulty = getDifficultyGroup(xmlGame);
          questionValues.languageDependence =
            getLanguageDependenceGroup(xmlGame);
          questionValues.isCoop = xmlGame.querySelector(
            "[value='Cooperative Game']"
          )
            ? 1
            : xmlGame.querySelector(
                "[value='Semi-Cooperative Game'], [value='Team-Based Game']"
              )
            ? 0
            : -1;

          // Coop games are automatically regarded as low conflict between the players. ChatGPT would say otherwise
          if (questionValues.isCoop === 1) questionValues.conflict = 1;

          return questionValues;
        })(xmlGame, game);

        game.filterValues = (function getValuesForBoardGameOMaticFilters(
          game,
          xmlGame,
          maxPlayerCount
        ) {
          const filterValues = game.filterValues || {}; // Object already exists if inventory location is present

          filterValues.playerNumbers = (function getValuesForFilterPlayerNumber(
            xmlGame,
            maxPlayerCount
          ) {
            function isRecommended(num, xmlGame) {
              const node = xmlGame.querySelector(
                `results[numplayers="${num}"]`
              );
              if (!node) return false;
              const intBest = +node
                .querySelector("result[value='Best']")
                .getAttribute("numvotes");
              const intRecommended = +node
                .querySelector("result[value='Recommended']")
                .getAttribute("numvotes");
              const intNotRecommended = +node
                .querySelector("result[value='Not Recommended']")
                .getAttribute("numvotes");
              // If at least two thirds of voters say, that the game is recommended for this player count, then the Boardgame-O-Matic recommends it as well
              if (intBest + intRecommended >= intNotRecommended * 2)
                return true;
              else return false;
            }
            const arRecommendedPlayerCount = [];
            for (let i = 1; i <= maxPlayerCount; i++) {
              if (isRecommended(i, xmlGame)) arRecommendedPlayerCount.push(i);
            }
            return arRecommendedPlayerCount;
          })(xmlGame, maxPlayerCount);

          filterValues.mechanics = (function getValuesForFilterMechanics(
            xmlGame
          ) {
            const arMechanics = [];
            arFilterOptionsMechanics.forEach((option) => {
              if (xmlGame.querySelector(option.selector))
                arMechanics.push(option.value);
            });

            if (
              (xmlGame.querySelector("[value='Fighting']") &&
                xmlGame.querySelector("[value='Territory Building']")) ||
              (xmlGame.querySelector("[value='Wargame']") &&
                xmlGame.querySelector("[value='Territory Building']"))
            ) {
              arMechanics.push("areaControl");
            }
            return arMechanics;
          })(xmlGame);

          filterValues.themes = (function getValuesForFilterThemes(xmlGame) {
            const arThemes = [];
            arFilterOptionsThemes.forEach((option) => {
              if (xmlGame.querySelector(option.selector))
                arThemes.push(option.value);
            });
            return arThemes;
          })(xmlGame);

          return filterValues;
        })(game, xmlGame, formInput.maxPlayerCount);

        game = (function importAndOverwriteValuesFromCachedGame(game) {
          const cachedGame = cache[`id${game.id}`]; // The object "cache" comes from the file cache.js
          // Import / overwrite values, except for the name of the game (it could be a localized title)
          if (cachedGame) {
            (function deepMerge(target, source) {
              for (const key in source) {
                if (
                  source[key] &&
                  typeof source[key] === "object" &&
                  !Array.isArray(source[key])
                ) {
                  // If the value is a nested object, recursively merge
                  target[key] = deepMerge(target[key] || {}, source[key]);
                } else {
                  // Otherwise, directly overwrite the value
                  target[key] = source[key];
                }
              }
              return target;
            })(game, cachedGame);
            // Object.keys(cachedObjGame).forEach((key) => {
            //   if (key !== "name") game[key] = cachedObjGame[key];
            // });
          }
          return game;
        })(game);

        game.descriptions = await (async function getDescriptions(
          game,
          xmlGame,
          isWantedTranslate,
          isWantedChatGpt
        ) {
          async function translateDescription(englishDescription) {
            return (await translate(englishDescription, "de")).replace(
              /"/g,
              "&quot;"
            );
          }

          const descriptions = game.descriptions || {}; // Could already be imported from cache

          descriptions.short = await (async function getDescriptionsShort(
            descriptions,
            gameId,
            isWantedTranslate
          ) {
            const descriptionsShort = descriptions.short || {}; // Could already be imported from cache
            if (!descriptionsShort.en) {
              // The short description / tagline is not included in the XML API
              // We need to access the internal JSON API
              // Is not accessible from frontend due to CORS, therefore we use a proxy server
              const responseFromBggInternalJsonApi = await (
                await fetch(
                  `http://localhost:3000/bgg-internal-json-api/api/geekitems?objectid=${gameId}&objecttype=thing`
                )
              ).json();
              descriptionsShort.en =
                responseFromBggInternalJsonApi.item.short_description?.replace(
                  /"/g,
                  "&quot;"
                ) ?? "";
            }
            if (
              !descriptionsShort.de &&
              isWantedTranslate &&
              !isWantedChatGpt
            ) {
              descriptionsShort.de = await translateDescription(
                descriptionsShort.en
              );
            }

            return descriptionsShort;
          })(descriptions, game.id, isWantedTranslate);

          if (!isWantedChatGpt) {
            descriptions.bgg = await (async function getDescriptionsLongBgg(
              descriptions,
              xmlGame,
              isWantedTranslate
            ) {
              const descriptionsBgg = descriptions.bgg || {}; // Could already be imported from cache

              if (!descriptionsBgg.en) {
                const fullDescription = xmlGame
                  .querySelector("description")
                  .textContent.replace(/"/g, "&quot;");
                // Source: https://stackoverflow.com/a/31093903, added "&" to take sentences followed by an HTML symbol into account
                const regexOneSentence = /.*?[.!?](?=\s[A-Z]|&|$)/;
                const regexThreeSentences = new RegExp(
                  `^(${regexOneSentence.source}${regexOneSentence.source}${regexOneSentence.source}).*`,
                  "m"
                );
                const firstThreeSentences = fullDescription.replace(
                  regexThreeSentences,
                  "$1"
                );

                if (firstThreeSentences.length >= 300) {
                  descriptionsBgg.en = firstThreeSentences;
                } else {
                  const regexFourSentences = new RegExp(
                    `^(${regexOneSentence.source}${regexOneSentence.source}${regexOneSentence.source}${regexOneSentence.source}).*`,
                    "m"
                  );
                  const firstFourSentences = fullDescription.replace(
                    regexFourSentences,
                    "$1"
                  );
                  descriptionsBgg.en = firstFourSentences;
                }
              }
              if (!descriptionsBgg.de && isWantedTranslate) {
                descriptionsBgg.de = await translateDescription(
                  descriptionsBgg.en
                );
              }

              return descriptionsBgg;
            })(descriptions, xmlGame, isWantedTranslate);
          }

          return descriptions;
        })(
          game,
          xmlGame,
          formInput.isWantedTranslate,
          formInput.isWantedChatGpt
        );

        if (
          formInput.isWantedChatGpt &&
          (!game.descriptions.chatGpt?.en ||
            !game.descriptions.chatGpt?.de ||
            !game.descriptions.short.de ||
            (!game.questionValues.conflict &&
              game.questionValues.conflict !== 0))
        ) {
          const [
            descriptionChatGptEnglish,
            descriptionChatGptGerman,
            conflictLevel,
            descriptionShortGerman,
          ] = await (async function getDescriptionsLongChatGpt(
            formInput,
            game,
            xmlGame
          ) {
            let prompt = `For the board game "${
              game.name
            }": Write an English description/pitch, a German description/pitch, rate the conflict level, and translate the "Tagline" I provide into German.

Rules for the descriptions/pitches:
1) Don't overstate it using too many fancy adjectives. Make it rather descriptive, but appealing and rouse some interest. 
2) The description shall have around 500 characters.
3) Don't just repeat the "Tagline" or copy phrases from it. You may copy phrases from the "Full description", but not from the "Tagline".
4) Try to cover both the theme and the basic mechanics and what makes this board game special.
5) Instead of writing something like "the players will", write "you will" (directly adress the readers). 
6) Use informal tone ("ihr") in German.
7) Also in German, don't use the generic masculinum, but gendered language with a colon, if necessary (e. g. "Gegner:innen").
8) The German description does not have to be a literal translation of the English description that you create. Use phrasing that makes sense in German.

For the conflict level: Please rate on a scale from 1 to -1, how conflictual is the player interaction?
1 means little conflict (like Taverns of Tiefenthal, Castles of Burgundy, Wingspan, Cascadia, Everdell, Quacks of Quedlinburg)
0 means medium conflict (like Beyond the Sun, Brass Birmingham, Terraforming Mars, Dune Imperium)
-1 means high conflict (like Risk, Scythe, Root, Barrage, Blood Rage)
Take a guess based on the information I provide. No decimal numbers, only 1, 0 or -1!

For the German translation of the "Tagline": Use informal tone and directly address the reader (singular).

Your answer must follow the following structure: "English description|||German description|||Conflict level|||German translation of the "Tagline". So, for example: "In XYZ, you will...|||XYZ ist ein...|||-1|||Entwickle ein..."

Information about the board game (from BoardGameGeek):

Name: ${game.name}

Playing time: Approx. ${
              xmlGame.querySelector("maxplaytime").getAttribute("value") * 1.25
            } min

Release year: ${game.year}

Tagline: ${game.descriptions.short.en}

Full description: ${xmlGame.querySelector("description").textContent}

Type: ${Array.from(xmlGame.querySelectorAll('[type="family"]'))
              .map((node) => node.getAttribute("name"))
              .join(", ")}

Mechanics: ${Array.from(xmlGame.querySelectorAll('[type="boardgamemechanic"]'))
              .map((node) => node.getAttribute("value"))
              .join(", ")}

Categories: ${Array.from(xmlGame.querySelectorAll('[type="boardgamecategory"]'))
              .map((node) => node.getAttribute("value"))
              .join(", ")}

Recommended player count: ${game.filterValues.playerNumbers.join(", ")}

Complexity (from 1 to 5):  ${xmlGame
              .querySelector("averageweight")
              .getAttribute("value")}

REMEMBER: Your answer must follow the following structure: "English description|||German description|||Conflict level|||German translation of the "Tagline". So, for example: "In XYZ, you will...|||XYZ ist ein...|||-1|||Entwickle ein..."
`;
            try {
              const response =
                await formInput.openaiInstance.createChatCompletion({
                  model: formInput.chatGptModel,
                  messages: [
                    {
                      role: "system",
                      content: "You are a helpful assistant.",
                    },
                    {
                      role: "user",
                      content: prompt,
                    },
                  ],
                });
              const answer = response.data.choices[0].message.content;
              const arValues = answer.split("|||");
              const [
                descriptionChatGptEnglish,
                descriptionChatGptGerman,
                descriptionShortGerman,
              ] = [arValues[0], arValues[1], arValues[3]].map((el) =>
                el.replace(/"/g, "&quot;").replace(/\n/g, "")
              );

              const conflictLevel = +arValues[2];
              console.log(
                `Conflict level for ${game.name}: ${
                  arValues[2]
                } (as number: ${+arValues[2]})`
              );

              return [
                descriptionChatGptEnglish,
                descriptionChatGptGerman,
                conflictLevel,
                descriptionShortGerman,
              ];
            } catch (e) {
              console.log("Error getting GPT completion: ", e);
            }
          })(formInput, game, xmlGame);
          game.descriptions.chatGpt = game.descriptions.chatGpt || {};
          game.descriptions.chatGpt.en =
            game.descriptions.chatGpt.en || descriptionChatGptEnglish;
          game.descriptions.chatGpt.de =
            game.descriptions.chatGpt.de || descriptionChatGptGerman;
          game.questionValues.conflict =
            game.questionValues.conflict ?? conflictLevel;
          game.descriptions.short.de =
            game.descriptions.short.de || descriptionShortGerman;
        }
        console.log(game);
        arGamesDetailedData.push(game);
      }
    }
    return arGamesDetailedData;
  })(arGamesBasicDataAndVersionData, formInput);

  console.log(arGamesDetailedData);

  (function createCsv(arGamesDetailedData, formInput) {
    function getFlags(arLanguages) {
      const dictionaryLanguageToCountryCode = {
        German: "de",
        English: "gb",
        French: "fr",
        Spanish: "es",
        Italian: "it",
        Dutch: "nl",
        Russian: "ru",
        Chinese: "ch",
        Swedish: "se",
        Norwegian: "no",
        Danish: "dk",
        Lituanian: "lt",
        Czech: "cz",
        Polish: "pl",
        Arabic: "sa",
        Estonian: "ee",
        Latvian: "lv",
        Lithuanian: "lt",
        Basque: "es-pv",
        Bulgarian: "bu",
        Japanese: "jp",
        Catalan: "es-ct",
        Croatian: "cr",
        Serbian: "rs",
        Slovenian: "si",
        Slovak: "sk",
        Portuguese: "pt",
        Finnish: "fi",
        Greek: "gr",
        Hebrew: "il",
        Hungarian: "hu",
        Icelandic: "is",
        Korean: "kr",
        Romanian: "ro",
        Macedonian: "mk",
        Thai: "th",
      };
      if (!arLanguages) return "";
      let result = "<span class='flags'>";
      arLanguages.forEach((language) => {
        result += `<img  \
src='https://flagicons.lipis.dev/flags/4x3/${dictionaryLanguageToCountryCode[language]}.svg' \
alt='${language}' \
title='${language}' \
/>`;
      });
      result += "</span>";
      return result;
    }
    let csv = "";
    const language = formInput.isWantedTranslate ? "de" : "en";
    arGamesDetailedData.forEach((game) => {
      let newEntry = `"ID";"${game.id}";
"Name";"${game.name}${game.year ? ` <small>(${game.year})</small>` : ""}";
"Beschreibung";"${
        game.descriptions.chatGpt[language] || game.descriptions.bgg[language]
      } ${
        game.arLanguages?.length > 0
          ? `<br><strong>${
              formInput.isWantedTranslate ? "Sprachen" : "Languages"
            }</strong>: ${getFlags(game.arLanguages)}`
          : ""
      }<span class='filter-values' \
data-player-number='${game.filterValues.playerNumbers.join(" ")}' \
data-mechanics='${game.filterValues.mechanics.join(" ")}' \
data-themes='${game.filterValues.themes.join(" ")}' \
${
  game.filterValues.inventoryLocation
    ? `data-inventory-location='${game.filterValues.inventoryLocation}'`
    : ""
}></span>";
"Tagline";"${game.descriptions.short[language]}";
"Thumbnail";"${game.thumbnail}";
"${game.questionValues.difficulty}";"Difficulty (2 = easy)";
"${game.questionValues.playTime}";"Play Time (2 = short)";
"${game.questionValues.isCoop}";"Cooperative vs. competetive (1 = cooperative)";
"${game.questionValues.conflict}";"Conflict (1 = low conflict)";
"${game.questionValues.languageDependence}";"Language Dependence (2 = no text)";
"${game.questionValues.yearGrouped}";"Release year (2 = new)";
"#####";"Freizeile";
`;
      csv += newEntry;
    });

    const downloadCsvLink = document.createElement("a");
    downloadCsvLink.setAttribute(
      "href",
      `data:text/plain;charset=utf-8,${encodeURIComponent(csv)}`
    );
    downloadCsvLink.setAttribute(
      "download",
      `${Date.now()}-${formInput.nameCollection}-games.csv`
    );
    document.querySelector("body").appendChild(downloadCsvLink);
    downloadCsvLink.click();
    document.querySelector("body").removeChild(downloadCsvLink);
  })(arGamesDetailedData, formInput);

  (async function updateCache(arGamesDetailedData) {
    const schemeOfValuesToAdd = {
      name: null,
      descriptions: {
        bgg: {
          en: null,
          de: null,
        },
        chatGpt: {
          en: null,
          de: null,
        },
        short: {
          en: null,
          de: null,
        },
      },
      questionValues: {
        conflict: null,
      },
    };

    arGamesDetailedData.forEach((game) => {
      const cachedGame = cache[`id${game.id}`] || {};
      (function deepMerge(scheme, target, source) {
        for (const key in scheme) {
          if (
            source[key] &&
            typeof source[key] === "object" &&
            !Array.isArray(source[key])
          ) {
            // If the value is a nested object, recursively merge
            target[key] = deepMerge(
              scheme[key],
              target[key] || {},
              source[key]
            );
          } else {
            // Otherwise, directly overwrite the value
            target[key] = source[key];
          }
        }
        return target;
      })(schemeOfValuesToAdd, cachedGame, game);
      cache[`id${game.id}`] = cachedGame;
    });

    // const responseCacheUpdate = await (
    //   await fetch("http://localhost:2096/cache-update", {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //     },
    //     body: JSON.stringify(cache),
    //   })
    // ).text();
    // console.log(responseCacheUpdate);

    const downloadCacheLink = document.createElement("a");
    downloadCacheLink.setAttribute(
      "href",
      `data:text/plain;charset=utf-8,${encodeURIComponent(
        `const cache = ${JSON.stringify(cache)}`
      )}`
    );
    downloadCacheLink.setAttribute(
      "download",
      `${Date.now()}-${formInput.nameCollection}-cache.js`
    );
    document.querySelector("body").appendChild(downloadCacheLink);
    downloadCacheLink.click();
    document.querySelector("body").removeChild(downloadCacheLink);
  })(arGamesDetailedData);
}
