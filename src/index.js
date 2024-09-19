import { Configuration, OpenAIApi } from "openai";

const globalVars = {
  clusterSize: 20,
};
document.querySelector("#submit").addEventListener("click", () => {
  // New empty arrays/object, in case they have been populated from previous runs
  globalVars.arGameObjs = [];
  globalVars.arGameObjs = [];
  globalVars.objFormInputs = {};
  globalVars.objFormInputs.translate =
    document.querySelector("#translate").checked;
  if (globalVars.objFormInputs.translate) {
    translate.engine = "deepl";
    translate.key = document.querySelector("#deeplApiKey").value;
    if (!translate.key) {
      console.warn(
        "You must provide a deepl api key if you want the descriptions of the games to be translated"
      );
      return;
    }
  }
  globalVars.objFormInputs.getConflictDataFromChatGPT =
    document.querySelector("#chatgpt").checked;
  if (globalVars.objFormInputs.getConflictDataFromChatGPT) {
    const apiKey = document.querySelector("#chatGptApiKey").value;
    if (!apiKey) {
      console.warn(
        "You must provide an OpenAI api key if you want to use ChatGPT to generate data about the conflict level of the games"
      );
      return;
    }
    const configurationChatGPT = new Configuration({ apiKey });
    globalVars.openai = new OpenAIApi(configurationChatGPT);
    globalVars.objFormInputs.chatGptModel =
      document.querySelector("#chatGptModel").value;
  }
  globalVars.objFormInputs.nameCollection =
    document.querySelector("#nameCollection").value;
  if (!globalVars.objFormInputs.nameCollection) {
    console.warn(
      "You must provide the name of a BoardGameGeek user to get the board game data for its collection."
    );
    return;
  }
  globalVars.objFormInputs.minRating =
    document.querySelector("#minRating").value;
  globalVars.objFormInputs.maxPlayerCount =
    +document.querySelector("#maxPlayerCount").value;
  if (!globalVars.objFormInputs.maxPlayerCount) {
    console.warn(
      "You must provide the maximum number of players for which it shall be indicated whether the game is recommended for so many players."
    );
    return;
  }
  globalVars.includeInventoryLocation = document.querySelector(
    "#inventory-location"
  ).checked;
  getCollection();
});

async function getCollection() {
  if (!globalVars.includeInventoryLocation) {
    const apiResponse = await fetch(
      `https://boardgamegeek.com/xmlapi2/collection\
?username=${globalVars.objFormInputs.nameCollection}\
${
  globalVars.objFormInputs.minRating
    ? `&minbggrating=${globalVars.objFormInputs.minRating}`
    : ""
}\
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
      return getCollection(); // Recursive call
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
        return;
      } else extractGameDataFromCollection(xmlCollection);
    }
  } else {
    document.querySelector("form").style.cssText = "display: none";
    const containerTextarea = document.createElement("div");
    containerTextarea.setAttribute(
      "id",
      "container-textarea-inventory-location"
    );
    function isSafari() {
      return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    }
    const linkForUser = `${
      isSafari() ? "" : "view-source:"
    }https://boardgamegeek.com/xmlapi2/collection?username=${
      globalVars.objFormInputs.nameCollection
    }${
      globalVars.objFormInputs.minRating
        ? `&minbggrating=${globalVars.objFormInputs.minRating}`
        : ""
    }&type=boardgame&excludesubtype=boardgameexpansion&own=1&version=1&stats=1&showprivate=1`;
    containerTextarea.innerHTML = `<p>The inventory location of games in a collection is part of the private info. It can only be accessed by the owner of the collection,
        who must be logged in. It can therefore not be retrieved through this automated script. However &ndash; as the logged-in user
        this collection belongs to &ndash; you can access the BoardGameGeek API manually in your browser using the provided link "Click here" below.</p>
        <p>If you get the message <code> Your request for this collection has been accepted and will be processed. Please try again later for access.</code>, just wait a few seconds and then reload (repeat if necessary).</p>
        <p>If you get a result, copy the <strong>source code</strong> of the page (starting with <code>&lt;?xml version=&quot;1.0&quot; encoding=&quot;utf-8&quot; ...&gt;</code>) and paste it into this text area. Make sure that the source code includes the string <code>privateinfo</code> (if not, login to BoardGameGeek in the same browser and try again).</p>
     <p><big>Copy the following link and open it in a new tab of your browser:</big><br><code>${linkForUser}</code></p>   
    <textarea rows="20" style="width: 100%;">Delete this placeholder text and paste the source code (XML) of the page you get from the API</textarea><br>
    <button id="submit-manual-xml-inventory-location">Submit</button>
     `;
    document.body.appendChild(containerTextarea);
    document
      .querySelector("#submit-manual-xml-inventory-location")
      .addEventListener("click", () => {
        const inputTextarea = document.querySelector("textarea").value;
        window.xml = inputTextarea;
        const parser = new DOMParser();
        try {
          const xmlCollection = parser.parseFromString(
            inputTextarea.trim(),
            "application/xml"
          );
          const parserError = xmlCollection.querySelector("parsererror");
          if (parserError) {
            throw new Error(parserError.textContent);
          }
          document.querySelector("form").style.cssText = "";
          document
            .querySelector("#container-textarea-inventory-location")
            .remove();
          extractGameDataFromCollection(xmlCollection);
        } catch (e) {
          console.error(
            "Error while parsing collection data to XML. The text you entered is probably not valid XML. Please try again."
          );
          console.error(e);
        }
      });
  }
}

function extractGameDataFromCollection(xmlCollection) {
  const nodelistAllGamesInCollection = xmlCollection.querySelectorAll(
    "item[subtype='boardgame']"
  );
  nodelistAllGamesInCollection.forEach((nodeGame) => {
    const serializer = new XMLSerializer();
    const xmlStr = serializer.serializeToString(nodeGame);

    // Log the serialized XML string (which is the readable form of the XML document)
    console.log(xmlStr);
    const objGame = {
      name: nodeGame.querySelector("name").textContent,
      id: +nodeGame.getAttribute("objectid"),
      geekRating: +nodeGame.querySelector("bayesaverage").getAttribute("value"),
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
    if (globalVars.includeInventoryLocation)
      objGame.inventoryLocation = nodeGame
        .querySelector("privateinfo")
        ?.getAttribute("inventorylocation");

    // Filter out duplicates
    if (globalVars.arGameObjs.every((obj) => obj.id !== objGame.id))
      globalVars.arGameObjs.push(objGame);
  });
  globalVars.arGameObjs.sort((a, b) => b.geekRating - a.geekRating);
  breakGamesIntoIdClusters();
}

function breakGamesIntoIdClusters() {
  const arAllIds = globalVars.arGameObjs.map((obj) => obj.id);
  const arIdClusters = [];
  for (let i = 0; i < arAllIds.length / globalVars.clusterSize; i++) {
    arIdClusters.push(
      arAllIds
        .slice(i * globalVars.clusterSize, (i + 1) * globalVars.clusterSize)
        .join(",")
    );
  }
  getDetailedDataForGames(arIdClusters);
}

async function getDetailedDataForGames(arIdClusters) {
  for (let i = 0; i < arIdClusters.length; i++) {
    const xmlAllGamesOfCluster = await getXmlDataForAllGamesInCluster(
      arIdClusters[i]
    );
    async function getXmlDataForAllGamesInCluster(strIdCluster) {
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
          console.log(
            "Error while trying to parse data of game cluster to xml"
          );
          return;
        } else return xmlAllGamesOfCluster;
      }
    }

    const nodelistAllGamesOfCluster =
      xmlAllGamesOfCluster.querySelectorAll("item");

    for (let j = 0; j < nodelistAllGamesOfCluster.length; j++) {
      const xmlGame = nodelistAllGamesOfCluster[j];
      const objGame = globalVars.arGameObjs[i * globalVars.clusterSize + j];
      // Extract the data from the xml and interpretate it in a way that the Boardgame-O-Matic can later understand it
      // Assign each interpretation result to the game object
      objGame.year =
        +xmlGame.querySelector("yearpublished")?.getAttribute("value") ?? "";
      const playTime =
        +xmlGame.querySelector("maxplaytime").getAttribute("value") * 1.25 ??
        null; // Official max time is multiplied by 1.25 to get more realistic play time
      if (!playTime)
        objGame.playTime = 99; // In the Boardgame-O-Matic, 99 means "Skip"
      else if (playTime < 45) objGame.playTime = 2;
      else if (playTime < 90) objGame.playTime = 1;
      else if (playTime < 120) objGame.playTime = 0;
      else if (playTime < 180) objGame.playTime = -1;
      else objGame.playTime = -2;

      const difficulty =
        +xmlGame.querySelector("averageweight").getAttribute("value") ?? null;
      if (!difficulty) objGame.difficulty = 99;
      else if (difficulty < 1.6) objGame.difficulty = 2;
      else if (difficulty < 2.25) objGame.difficulty = 1;
      else if (difficulty < 3.0) objGame.difficulty = 0;
      else if (difficulty < 3.5) objGame.difficulty = -1;
      else objGame.difficulty = -2;

      // Alternative version:
      // if (!difficulty) objGame.difficulty = 99;
      // else if (difficulty < 1.5) objGame.difficulty = 2;
      // else if (difficulty < 2) objGame.difficulty = 1;
      // else if (difficulty < 2.75) objGame.difficulty = 0;
      // else if (difficulty < 3.5) objGame.difficulty = -1;
      // else objGame.difficulty = -2;

      objGame.arRecommendedPlayerCount = [];
      for (let k = 0; k < globalVars.objFormInputs.maxPlayerCount; k++) {
        const isRecommended = checkIfRecommended(k, xmlGame);
        if (isRecommended) objGame.arRecommendedPlayerCount.push(isRecommended);
      }
      function checkIfRecommended(num, game) {
        const node = game.querySelector(`results[numplayers="${num}"]`);
        if (!node) return "";
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
        let returnValue = "";
        if (intBest + intRecommended >= intNotRecommended * 2)
          returnValue = num.toString();

        const arBestVotesForAllPlayerNumbers = Array.from(
          game.querySelectorAll("[value='Best']")
        ).map((node) => +node.getAttribute("numvotes"));
        if (
          arBestVotesForAllPlayerNumbers.every(
            (numVotes) => intBest >= numVotes
          )
        )
          returnValue += " (ideal)";
        return returnValue;
      }

      objGame.languageDependence = getLanguageDependence(xmlGame);

      function getLanguageDependence(game) {
        const totalVotes = +game
          .querySelector("[title='Language Dependence']")
          .getAttribute("totalvotes");
        if (totalVotes === 0) return 99;
        const littleText =
          +game
            .querySelector("[value='No necessary in-game text']")
            .getAttribute("numvotes") +
          +game
            .querySelector("[value^='Some necessary text']")
            .getAttribute("numvotes");
        const someText = +game
          .querySelector("[value^='Moderate in-game text']")
          .getAttribute("numvotes");
        const muchText =
          +game
            .querySelector("[value^='Extensive use of text']")
            .getAttribute("numvotes") +
          +game
            .querySelector("[value='Unplayable in another language']")
            .getAttribute("numvotes");
        if (littleText >= someText && littleText >= muchText) return 1;
        else if (someText >= muchText) return 0;
        else return -1;
      }

      objGame.isCoop = xmlGame.querySelector("[value='Cooperative Game']")
        ? 1
        : xmlGame.querySelector(
            "[value='Semi-Cooperative Game'], [value='Team-Based Game']"
          )
        ? 0
        : -1;

      // Coop games are automatically regarded as low conflict between the players. ChatGPT would say otherwise
      if (objGame.isCoop === 1) objGame.conflict = 1;

      objGame.deduction = xmlGame.querySelector(
        "[value='Deduction'], [value='Pattern Recognition']"
      )
        ? 1
        : -1;
      objGame.economic = xmlGame.querySelector(
        "[value='Economic'],[value='Industry / Manufacturing']"
      )
        ? 1
        : xmlGame.querySelector("[value='Income']")
        ? 0
        : -1;
      objGame.puzzle = xmlGame.querySelector(
        "[value='Puzzle'], [value='Pattern Building']"
      )
        ? 1
        : xmlGame.querySelector("[value='Tile Placement']")
        ? 0
        : -1;
      objGame.speed = xmlGame.querySelector(
        "[value='Real-Time'], [value='Real-time']"
      )
        ? 1
        : xmlGame.querySelector("[value='Action / Dexterity']")
        ? 0
        : -1;
      objGame.areaControl = xmlGame.querySelector(
        "[value='Area Majority / Influence'], [value='Enclosure']"
      )
        ? 1
        : xmlGame.querySelector("[value='Territory Building']")
        ? 0
        : -1;
      objGame.interactive = xmlGame.querySelector(
        "[value='Take That'], [value='Player Elimination'], [value='Fighting'], [value='Wargame']"
      )
        ? 1
        : xmlGame.querySelector(
            "[value='Cooperative Game'], [value='Semi-Cooperative Game'], [value='Team-Based Game']"
          )
        ? 0
        : -1;
      objGame.playerElimination = xmlGame.querySelector(
        "[value='Player Elimination']"
      )
        ? 1
        : -1;
      objGame.pushYourLuck = xmlGame.querySelector("[value='Push Your Luck']")
        ? 1
        : -1;
      objGame.auction = xmlGame.querySelector("[value*='Auction']") ? 1 : -1;
      objGame.deckBuilding = xmlGame.querySelector(
        "[value='Deck, Bag, and Pool Building']"
      )
        ? 1
        : xmlGame.querySelector("[value='Deck Construction']")
        ? 0
        : -1;
      objGame.creative = xmlGame.querySelector(
        "[value='Drawing'], [value='Mechanism: Drawing'], [value='Acting'], [value='Word Games: Guess the Word'],  [value='Mechanism: Give a Clue / Get a Clue']"
      )
        ? 1
        : -1;
      objGame.workerPlacement = xmlGame.querySelector(
        "[value*='Worker Placement']"
      )
        ? 1
        : -1;
      objGame.trickTaking = xmlGame.querySelector("[value='Trick-taking']")
        ? 1
        : -1;
      objGame.drafting = xmlGame.querySelector(
        "[value='Closed Drafting'], [value*='Dice Drafting']"
      )
        ? 1
        : xmlGame.querySelector("[value='Open Drafting']")
        ? 0
        : -1;
      objGame.rollAndWrite = xmlGame.querySelector(
        "[value*='Roll-and-Write'], [value*='Flip-and-Write']"
      )
        ? 1
        : -1;

      const cachedGameObj = cache[`id${objGame.id}`]; // The object "cache" comes from the file cache.js

      // Import / overwrite values, except for the name of the game (it could be a localized title)
      if (cachedGameObj) {
        Object.keys(cachedGameObj).forEach((key) => {
          if (key !== "name") objGame[key] = cachedGameObj[key];
        });
      }

      // Descriptions could be already imported from cache, therefore check first
      if (!objGame.descriptionLongEn) {
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
        const regexFourSentences = new RegExp(
          `^(${regexOneSentence.source}${regexOneSentence.source}${regexOneSentence.source}${regexOneSentence.source}).*`,
          "m"
        );
        const firstFourSentences = fullDescription.replace(
          regexFourSentences,
          "$1"
        );
        objGame.descriptionLongEn =
          firstThreeSentences.length >= 300
            ? firstThreeSentences
            : firstFourSentences;
      }

      if (!objGame.descriptionShortEn) {
        // The short description / tagline is not included in the XML API
        // We need to access the internal JSON API
        // Is not accessible from frontend due to CORS, therefore we use a proxy server
        const responseFromBggInternalJsonApi = await (
          await fetch(
            `http://localhost:3000/api/geekitems?objectid=${objGame.id}&objecttype=thing`
          )
        ).json();
        objGame.descriptionShortEn =
          responseFromBggInternalJsonApi.item.short_description?.replace(
            /"/g,
            "&quot;"
          ) ?? "";
      }

      async function translateDescription(descriptionEn) {
        return (await translate(descriptionEn, "de")).replace(/"/g, "&quot;");
      }

      if (globalVars.objFormInputs.translate) {
        // Translated descriptions could be already imported from cache, therefore check first if present
        if (!objGame.descriptionLongDe) {
          objGame.descriptionLongDe = await translateDescription(
            objGame.descriptionLongEn
          );
          objGame.addThisObjToCache = true;
        }
        if (!objGame.descriptionShortDe && objGame.descriptionShortEn) {
          objGame.descriptionShortDe = await translateDescription(
            objGame.descriptionShortEn
          );
          objGame.addThisObjToCache = true;
        }
      } else {
        objGame.descriptionLongDe = null;
        objGame.descriptionShortDe = null;
      }

      // ChatGPT only knows games older than from 2022
      if (
        globalVars.objFormInputs.getConflictDataFromChatGPT &&
        objGame.year >= 2022 &&
        objGame.conflict === undefined
      ) {
        objGame.conflict = await getConflictLevelFromChatGptForRecentGame(
          objGame,
          xmlGame
        );
        objGame.addThisObjToCache = true;
      }
    } // end for-loop of games within one cluster
  } // end for-loop of arIdClusters
  // Send all games older than 2022 in one big cluster to ChatGPT in order to save tokens
  if (globalVars.objFormInputs.getConflictDataFromChatGPT)
    await getConflictLevelFromChatGptForOlderGames();
  console.log(globalVars.arGameObjs);
  createCsv();
} // end getDetailedDataForGames()

async function getConflictLevelFromChatGptForRecentGame(objGame, xmlGame) {
  let prompt = `For the board game I will describe to you, please rate on a scale from 1 to -1, how conflictual is the player interaction?
  1 means little conflict (like Taverns of Tiefenthal, Castles of Burgundy, Wingspan, Cascadia, Everdell, Quacks of Quedlinburg)
0 means medium conflict (like 7 Wonders, Beyond the Sun, Brass Birmingham, Terraforming Mars, Dune Imperium)
-1 means high conflict (like Risk, Scythe, Root, Barrage, Blood Rage)

Take a guess based on the information I provide. No decimal numbers, only 1, 0 or -1!

Name: ${objGame.name}

Tagline: ${objGame.descriptionShortEn}

Description: ${xmlGame.querySelector("description").textContent}

Type: ${Array.from(xmlGame.querySelectorAll('[type="family"'))
    .map((node) => node.getAttribute("name"))
    .join(", ")}

Mechanics: ${Array.from(xmlGame.querySelectorAll('[type="boardgamemechanic"'))
    .map((node) => node.getAttribute("value"))
    .join(", ")}

Categories: ${Array.from(xmlGame.querySelectorAll('[type="boardgamecategory"'))
    .map((node) => node.getAttribute("value"))
    .join(", ")}

Recommended player count: ${objGame.arRecommendedPlayerCount.join(", ")}

Complexity (from 1 to 5):  ${xmlGame
    .querySelector("averageweight")
    .getAttribute("value")}
    
    You answer must end with the number you choose (1, 0 or -1), it must be the end of the last sentence!`;
  // Instead of just asking for a single number as reply without a comment/explanation, we allow ChatGPT to write an explanation
  // Tests have shown that this makes the number more accurate
  // The challenge is now to extract the number from the reply (see below)

  try {
    const response = await globalVars.openai.createChatCompletion({
      model: globalVars.objFormInputs.chatGptModel,
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
}

async function getConflictLevelFromChatGptForOlderGames() {
  const arGamesOlderThan2022 = globalVars.arGameObjs.filter(
    (objGame) => objGame.year < 2022 && objGame.conflict === undefined
  );
  if (arGamesOlderThan2022.length === 0) return;
  const arNamesOnly = arGamesOlderThan2022.map((objGame) =>
    objGame.name.replace(/^/, '"').replace(/$/, '"')
  );
  let prompt = `For the list of board games I provide, please rate each game on a scale from 1 to -1, how conflictual is the player interaction?
  1 means little conflict (like Taverns of Tiefenthal, Castles of Burgundy, Wingspan, Cascadia, Everdell, Quacks of Quedlinburg)
0 means medium conflict (like 7 Wonders, Beyond the Sun, Brass Birmingham, Terraforming Mars, Dune Imperium)
-1 means high conflict (like Risk, Scythe, Root, Barrage, Blood Rage)
No decimal numbers, only 1, 0 or -1!

${arNamesOnly.join("\n")}

Your reply must look exactly as follows:

"Game A"§ 1
"Game B"§ -1
...`;
  // We use the symbol § as delimiter, because the likelihood that it appears in the name of a game is really low
  console.log(prompt);
  try {
    const response = await globalVars.openai.createChatCompletion({
      model: globalVars.objFormInputs.chatGptModel,
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
      globalVars.arGameObjs.forEach((game) => {
        if (subar[0] === game.name) {
          game.conflict = subar[1];
          game.addThisObjToCache = true;
        }
      });
    });
  } catch (e) {
    console.log("Error getting GPT completion: ", e);
  }
}

function createCsv() {
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
      result += `<img \
  src='https://flagicons.lipis.dev/flags/4x3/${dictionaryLanguageToCountryCode[language]}.svg' \
  alt='${language}' \
  title='${language}' \
  />`;
    });
    result += "<span>";
    return result;
  }
  let csv = "";
  globalVars.arGameObjs.forEach((game) => {
    let newEntry = `"ID";"${game.id}";
"Name";"${game.name}${game.year ? ` (${game.year})` : ""}";
"Beschreibung";"${game.descriptionLongDe || game.descriptionLongEn}<br>\
<strong>${
      globalVars.objFormInputs.translate ? "Geeignet für" : "Suitable for"
    }</strong>\
${game.arRecommendedPlayerCount.join(", ")}\
${
  game.arLanguages
    ? `<br><strong>${
        globalVars.objFormInputs.translate ? "Sprachen" : "Languages"
      }</strong>: ${getFlags(game.arLanguages)}`
    : ""
}<span class='filter-values' data-player-number='${game.arRecommendedPlayerCount
      .map((item) => item.replace(" (ideal)", ""))
      .join(" ")}'\
${
  game.inventoryLocation
    ? ` data-inventory-location='${game.inventoryLocation}'`
    : ""
}></span>";
"Tagline";"${game.descriptionShortDe || game.descriptionShortEn || ""}";
"Thumbnail";"${game.thumbnail}";
"${game.difficulty}";"";
"${game.playTime}";"";
"${game.languageDependence}";"";
"${game.conflict}";"";
"${game.isCoop}";"";
"${game.economic}";"";
"${game.areaControl}";"";
"${game.creative}";"";
"${game.puzzle}";"";
"${game.deduction}";"";
"${game.speed}";"";
"${game.deckBuilding}";"";
"${game.workerPlacement}";"";
"${game.rollAndWrite}";"";
"${game.pushYourLuck}";"";
"${game.drafting}";"";
"#####";"Freizeile";
`;
    if (game.arLanguages) {
      // Add "players" after final recommended number, that is before "Languages", and remove trailing comma
      if (!globalVars.objFormInputs.translate)
        newEntry = newEntry.replace(/,(<br><strong>Languages)/g, " players$1");
      else
        newEntry = newEntry.replace(
          /,(<br><strong>Sprachen)/g,
          " Spieler:innen$1"
        );
    } else {
      // "Languages" is not there, use next line starting with "Tagline" for locating the final recommended number
      newEntry = newEntry.replace(
        /,(";\n"Tagline)/,
        ` ${
          !globalVars.objFormInputs.translate ? "players" : "Spieler:innen"
        }$1`
      );
    }
    csv += newEntry;
  });

  const downloadCsvLink = document.createElement("a");
  downloadCsvLink.setAttribute(
    "href",
    `data:text/plain;charset=utf-8,${encodeURIComponent(csv)}`
  );
  downloadCsvLink.setAttribute(
    "download",
    `${Date.now()}-${globalVars.objFormInputs.nameCollection}-spiele.csv`
  );
  document.querySelector("body").appendChild(downloadCsvLink);
  downloadCsvLink.click();
  document.querySelector("body").removeChild(downloadCsvLink);

  const objGamesToBeAddedToCache = {};
  globalVars.arGameObjs.forEach((game) => {
    if (game.addThisObjToCache) {
      objGamesToBeAddedToCache[`id${game.id}`] = {
        name: game.name,
        descriptionLongEn: game.descriptionLongEn,
        descriptionLongDe: game.descriptionLongDe,
        descriptionShortEn: game.descriptionShortEn,
        descriptionShortDe: game.descriptionShortDe,
        conflict: game.conflict,
      };
    }
  });
  if (Object.keys(objGamesToBeAddedToCache).length !== 0) {
    const downloadCacheLink = document.createElement("a");
    downloadCacheLink.setAttribute(
      "href",
      `data:text/plain;charset=utf-8,${encodeURIComponent(
        JSON.stringify(objGamesToBeAddedToCache).slice(1).slice(0, -1)
      )}`
    );
    downloadCacheLink.setAttribute(
      "download",
      `${Date.now()}-${globalVars.objFormInputs.nameCollection}-cache.js`
    );
    document.querySelector("body").appendChild(downloadCacheLink);
    downloadCacheLink.click();
    document.querySelector("body").removeChild(downloadCacheLink);
  } else {
    console.log("No new games to be added to cache");
  }
}
