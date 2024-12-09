require("source-map-support").install();

import { Configuration, OpenAIApi } from "openai";

const CLUSTER_SIZE = 20;

document.querySelector("#submit").addEventListener("click", () => {
  try {
    const formInput = (function readUserInputFromForm() {
      const input = {
        isWantedTranslate: document.querySelector("#translate").checked,
        isWantedConflictDataFromChatGPT:
          document.querySelector("#chatgpt").checked,
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
      if (input.isWantedConflictDataFromChatGPT) {
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

            if (
              xmlGame.querySelector(
                "[value='Deduction'], [value='Pattern Recognition']"
              )
            )
              arMechanics.push("deduction");

            if (
              xmlGame.querySelector(
                "[value='Pattern Building'], [value='Tile Placement'], [value='Grid Coverage']"
              )
            )
              arMechanics.push("tilePlacement");

            if (
              xmlGame.querySelector(
                "[value='Real-Time'], [value='Real-time'], [value='Action / Dexterity'], [value='Flicking'], [value='Stacking and Balancing']"
              )
            )
              arMechanics.push("action");

            if (xmlGame.querySelector("[value='Area Majority / Influence']"))
              arMechanics.push("areaControl");
            // if (xmlGame.querySelector("[value='Player Elimination']")) game.arMechanisms.push("playerElimination");
            if (xmlGame.querySelector("[value='Push Your Luck']"))
              arMechanics.push("pushYourLuck");

            if (xmlGame.querySelector("[value*='Auction']"))
              arMechanics.push("auction");

            if (
              xmlGame.querySelector(
                "[value='Deck, Bag, and Pool Building'], [value='Deck Construction']"
              )
            )
              arMechanics.push("deckBuilding");

            if (xmlGame.querySelector("[value*='Worker Placement']"))
              arMechanics.push("workerPlacement");

            if (
              xmlGame.querySelector(
                "[value='Trick-taking'], [value='Ladder Climbing'] "
              )
            )
              arMechanics.push("trickTaking");

            if (
              xmlGame.querySelector(
                "[value='Closed Drafting'], [value='Open Drafting'], [value*='Dice Drafting']"
              )
            )
              arMechanics.push("drafting");

            if (
              xmlGame.querySelector(
                "[value*='Roll-and-Write'], [value*='Flip-and-Write']"
              )
            )
              arMechanics.push("rollAndWrite");

            if (xmlGame.querySelector("[value='Party Game']"))
              arMechanics.push("party");

            if (xmlGame.querySelector("[value='Drawing'], [value='Acting']"))
              arMechanics.push("drawing");

            if (
              xmlGame.querySelector("[value='Trading'], [value='Negotiation']")
            )
              arMechanics.push("trading");

            // game.creative = xmlGame.querySelector(
            //   "[value='Drawing'], [value='Mechanism: Drawing'], [value='Acting'], [value='Word Games: Guess the Word'],  [value='Mechanism: Give a Clue / Get a Clue']"
            // )
            //   ? 1
            //   : -1;

            return arMechanics;
          })(xmlGame);

          filterValues.themes = (function getValuesForFilterThemes(xmlGame) {
            const arThemes = [];

            if (xmlGame.querySelector("[value='Adventure']"))
              arThemes.push("adventure");
            if (xmlGame.querySelector("[value='American West']"))
              arThemes.push("wildWest");
            if (xmlGame.querySelector("[value='Ancient']"))
              arThemes.push("ancient");
            if (xmlGame.querySelector("[value='Prehistoric']"))
              arThemes.push("prehistoric");
            if (
              xmlGame.querySelector(
                "[value='Animals'], [value='Environmental']"
              )
            )
              arThemes.push("animals");
            if (
              xmlGame.querySelector(
                "[value='City Building'], [value='Industry / Manufacturing']"
              )
            )
              arThemes.push("cities");
            if (xmlGame.querySelector("[value='Fantasy'], [value='Mythology']"))
              arThemes.push("fantasy");
            if (xmlGame.querySelector("[value='Farming']"))
              arThemes.push("farming");
            if (xmlGame.querySelector("[value='Horror'], [value='Zombies']"))
              arThemes.push("horror");
            if (
              xmlGame.querySelector("[value='Renaissance'], [value='Medieval']")
            )
              arThemes.push("medieval");
            if (xmlGame.querySelector("[value='Nautical'], [value='Pirates']"))
              arThemes.push("nautical");
            if (xmlGame.querySelector("[value='Racing']"))
              arThemes.push("racing");
            if (xmlGame.querySelector("[value='Science Fiction']"))
              arThemes.push("scifi");
            if (
              xmlGame.querySelector("[type='boardgamecategory'][value*='War']")
            )
              arThemes.push("war");

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
          isWantedTranslate
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
            if (!descriptionsShort.de && isWantedTranslate) {
              descriptionsShort.de = await translateDescription(
                descriptionsShort.en
              );
            }

            return descriptionsShort;
          })(descriptions, game.id, isWantedTranslate);
          descriptions.long = await (async function getDescriptionsLong(
            descriptions,
            xmlGame,
            isWantedTranslate
          ) {
            const descriptionsLong = descriptions.long || {}; // Could already be imported from cache
            if (!descriptionsLong.en) {
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
                descriptionsLong.en = firstThreeSentences;
              } else {
                const regexFourSentences = new RegExp(
                  `^(${regexOneSentence.source}${regexOneSentence.source}${regexOneSentence.source}${regexOneSentence.source}).*`,
                  "m"
                );
                const firstFourSentences = fullDescription.replace(
                  regexFourSentences,
                  "$1"
                );
                descriptionsLong.en = firstFourSentences;
              }
            }
            if (!descriptionsLong.de && isWantedTranslate) {
              descriptionsLong.de = await translateDescription(
                descriptionsLong.en
              );
            }
            return descriptionsLong;
          })(descriptions, xmlGame, isWantedTranslate);
          return descriptions;
        })(game, xmlGame, formInput.isWantedTranslate);

        if (
          formInput.isWantedConflictDataFromChatGPT &&
          game.year >= 2022 && // ChatGPT only knows games released before 2022
          game.questionValues.conflict === undefined // Could already be imported or be set because game is cooperative (and therefore automatically low conflict)
        ) {
          // This is done after importing from cache in order to reduce the usage of the ChatGPT API
          // (asking ChatGPT can be avoided if the conflict group for a game is already known from a previous run)
          game.questionValues.conflict =
            await (async function getConflictLevelFromChatGptForRecentGame(
              game,
              xmlGame,
              formInput
            ) {
              let prompt = `For the board game I will describe to you, please rate on a scale from 1 to -1, how conflictual is the player interaction?
              1 means little conflict (like Taverns of Tiefenthal, Castles of Burgundy, Wingspan, Cascadia, Everdell, Quacks of Quedlinburg)
            0 means medium conflict (like Beyond the Sun, Brass Birmingham, Terraforming Mars, Dune Imperium)
            -1 means high conflict (like Risk, Scythe, Root, Barrage, Blood Rage)
            
            Take a guess based on the information I provide. No decimal numbers, only 1, 0 or -1!
            
            Name: ${game.name}
            
            Tagline: ${game.descriptions.short.en}
            
            Description: ${xmlGame.querySelector("description").textContent}
            
            Type: ${Array.from(xmlGame.querySelectorAll('[type="family"'))
              .map((node) => node.getAttribute("name"))
              .join(", ")}
            
            Mechanics: ${Array.from(
              xmlGame.querySelectorAll('[type="boardgamemechanic"')
            )
              .map((node) => node.getAttribute("value"))
              .join(", ")}
            
            Categories: ${Array.from(
              xmlGame.querySelectorAll('[type="boardgamecategory"')
            )
              .map((node) => node.getAttribute("value"))
              .join(", ")}
            
            Recommended player count: ${game.filterValues.playerNumbers.join(
              ", "
            )}
            
            Complexity (from 1 to 5):  ${xmlGame
              .querySelector("averageweight")
              .getAttribute("value")}
                
                You answer must end with the number you choose (1, 0 or -1), it must be the end of the last sentence!`;
              // Instead of just asking for a single number as reply without a comment/explanation, we allow ChatGPT to write an explanation
              // Tests have shown that this makes the number more accurate
              // The challenge is now to extract the number from the reply (see below)

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
                console.log(answer);
                // Get the number (1 / 0 / -1) from the text reply
                const processedAnswer = answer
                  .replace(/[.,()!?*]/g, "")
                  .split(" ")
                  .map((value) => +value)
                  .filter((value) => !isNaN(value));
                console.log(processedAnswer);
                // We asked ChatGPT to put the number at the end of the last sentence, therefore we take the last number in the reply
                return processedAnswer[processedAnswer.length - 1];
              } catch (e) {
                console.log("Error getting GPT completion: ", e);
              }
            })(game, xmlGame, formInput);
        }
        arGamesDetailedData.push(game);
      }
    }
    // Send all games older than 2022 in one big cluster to ChatGPT, asking the AI to rate the conflict level
    // Done at bulk instead of separately for each game in order to save tokens
    if (formInput.isWantedConflictDataFromChatGPT) {
      arGamesDetailedData =
        await (async function getConflictGroupFromChatGptForOlderGames(
          arGamesDetailedData,
          formInput
        ) {
          const arGamesToBeEvaluated = arGamesDetailedData.filter(
            (game) =>
              game.year < 2022 && game.questionValues.conflict === undefined
          );
          if (arGamesToBeEvaluated.length === 0) return arGamesDetailedData;
          const arNamesOfGamesToBeEvaluated = arGamesToBeEvaluated.map((game) =>
            game.name.replace(/^/, '"').replace(/$/, '"')
          );
          let prompt = `For the list of board games I provide, please rate each game on a scale from 1 to -1, how conflictual is the player interaction?
        1 means little conflict (like Taverns of Tiefenthal, Castles of Burgundy, Wingspan, Cascadia, Everdell, Quacks of Quedlinburg)
      0 means medium conflict (like 7 Wonders, Beyond the Sun, Brass Birmingham, Terraforming Mars, Dune Imperium)
      -1 means high conflict (like Risk, Scythe, Root, Barrage, Blood Rage)
      No decimal numbers, only 1, 0 or -1!
      
      ${arNamesOfGamesToBeEvaluated.join("\n")}
      
      Your reply must look exactly as follows:
      
      "Game A"§ 1
      "Game B"§ -1
      ...`;
          // We use the symbol § as delimiter, because the likelihood that it appears in the name of a game is really low
          console.log(prompt);
          try {
            const response =
              await formInput.openaiInstance.createChatCompletion({
                model: formInput.chatGptModel,
                messages: [
                  { role: "system", content: "You are a helpful assistant." },
                  {
                    role: "user",
                    content: prompt,
                  },
                ],
              });
            const answer = response.data.choices[0].message.content;
            console.log(answer);
            let processedAnswer = answer
              .split("\n")
              .map((str) => str.split("§"))
              .map((subar) => {
                // Remove quotes from beginning and end of board game title
                // Transform string reply ("1" / "0" / "-1") to number (1 / 0 / -1)
                return [subar[0].substring(1, subar[0].length - 1), +subar[1]];
              });
            console.log(processedAnswer);

            // Assign values to corresponding objects
            processedAnswer.forEach((subar) => {
              arGamesDetailedData.forEach((game) => {
                if (subar[0] === game.name) {
                  game.questionValues.conflict = subar[1];
                }
              });
            });
            return arGamesDetailedData;
          } catch (e) {
            console.log("Error getting GPT completion: ", e);
          }
        })(arGamesDetailedData, formInput);
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
    arGamesDetailedData.forEach((game) => {
      let newEntry = `"ID";"${game.id}";
"Name";"${game.name}${game.year ? ` <small>(${game.year})</small>` : ""}";
"Beschreibung";"${
        game.descriptions.long[`${formInput.isWantedTranslate ? "de" : "en"}`]
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
"Tagline";"${
        game.descriptions.short[`${formInput.isWantedTranslate ? "de" : "en"}`]
      }";
"Thumbnail";"${game.thumbnail}";
"${game.questionValues.difficulty}";"Difficulty (2 = easy)";
"${game.questionValues.playTime}";"Play Time (2 = short)";
"${game.questionValues.languageDependence}";"Language Dependence (2 = no text)";
"${game.questionValues.conflict}";"Conflict (1 = low conflict)";
"${game.questionValues.isCoop}";"Cooperative vs. competetive (1 = cooperative)";
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
      `${Date.now()}-${formInput.nameCollection}-spiele.csv`
    );
    document.querySelector("body").appendChild(downloadCsvLink);
    downloadCsvLink.click();
    document.querySelector("body").removeChild(downloadCsvLink);
  })(arGamesDetailedData, formInput);

  (async function updateCache(arGamesDetailedData) {
    const schemeOfValuesToAdd = {
      name: null,
      descriptions: {
        long: {
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

    const responseCacheUpdate = await (
      await fetch("http://localhost:2096/cache-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cache),
      })
    ).text();
    console.log(responseCacheUpdate);
  })(arGamesDetailedData);
}
