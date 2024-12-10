# CSV Generation Tool for the [BoardGame-O-Matic](https://github.com/fenglisch/boardgame-o-matic) (Brettspiel-O-Mat)

This tool takes any users' collection from BoardGameGeek.com (BGG) and looks up data about each game in the collection from different sources, mainly from the [BGG XML API2](https://boardgamegeek.com/wiki/page/BGG_XML_API2). The tool interpretates the data and eventually generates a CSV file with information about all the games. This CSV file can then be used as the "database" for your own [**BoardGame-O-Matic**](https://github.com/fenglisch/boardgame-o-matic) (German: Brettspiel-O-Mat, short: BOM).

## How to install

Requirements:

- node
- npm

Steps:

- Download the repository: `$ git clone https://github.com/fenglisch/generate-csv-file-for-boardgame-o-matic.git`
- Navigate into the directory: `$ cd generate-csv-file-for-boardgame-o-matic/`
- Run `$ npm install`
- Run `$ npm start`
  - This is a combination of `$ webpack --watch` (build dist/bundle.js and rebuild every time src/index.js is updated) and `$ node proxy-server.js`. You can also run both commands separaretly.

That's it.

## How to use

Requirements:

- A BGG collection
  - The tool needs to know which games it should look up and include in the final CSV file (and therefore in the BOM). This works by providing the name of a BGG user. The tool then simply looks at this user's collection.
  - A BGG collection is therefore required. If you don't have a collection yet, don't worry. Signup is free of charge, see also [BGG FAQ about user collections](https://boardgamegeek.com/wiki/page/BoardGameGeek_FAQ#toc24). If your list of games is really long and manually adding them to your collection would be quite a hassle, no worries, I got you covered. You can bulk import the list of your games into your BGG collection with my [bgg-bulk-upload tool](https://github.com/fenglisch/bgg-bulk-upload).

Steps:

- Open the `index.html` file in the browser of your choice (I only tested with Firefox).
- Fill out the form and press "Submit".
- Check the console and network tab of your browser to see the progress.
  - So far, there is no logging on screen, only in the console to a limited degree. The network tab is especially helpful in order to track all the network requests.
- When finished, the CSV file will automatically be downloaded. Use it for your BoardGame-O-Matic

## How it works

- The program takes the inputs from your form, most importantly the name of the BGG collection.
- It makes a request to the BGG API to get data about the games in the given collection.
  - If you provided a minimum GeekRating in the form, all games below this treshold are excluded.
  - Board game expansions are always excluded.
- The XML file for the collection includes general data about each game. This data is read from the file and stored.
  - If the BGG collection includes not only general references to board games, but specific versions, the program gets the localised title and thumbnail for the specific version of the game, plus the language(s).
  - Duplicates are filtered out.
  - The resulting list of games (represented as objects) is sorted by GeekRating (descending).
- Since the XML file for the collection only includes general data about the games in it, the program must now get full information about each game
  - Luckily, we must not make one request to the BGG API for each single game. Instead, the games are put into large clusters. We now make one request to the BGG API to get all information about all the games for each cluster
- The data about the game is read and interpretated. For example, the games are grouped into categories based on their play time or difficuly.
  - The logic of this interpretation can be seen and changed directly in the code of `src/index.js`, in the function `getDetailedDataForGames`
- Next, the program looks if the game is already stored in the cache (not a real cache, but an object in the file `cache.js`). If so, the data about the game from the cache is imported. This can lead to overriding data which was just read from the BGG API and interpretated. This is intended.
- Unless the cache had all descriptions for the game, these are now read
  - The long description is the first 3 - 4 sentences of the general description of the game in BGG.
  - The short description is the tagline, accessed from the internal JSON API from BGG, since it is not included in the public XML API. Accessing the internal JSON API requires the proxy server (which you started by running `$ npm start` or `$ node proxy-server.js`), because otherwise you would get CORS errors.
  - If translation into German is wished for (in the initial submit of the form), the descriptions are sent individually to the Deepl API.
- If you indicated in the form that you want data about the conflict level for each game, this data is generated using the ChatGPT API (there is no data in BGG that could be used to get information about the conflict level of each game).
  - ChatGPT does have information about games older than 2022. Therefore, a list of these "older" games is simply sent to ChatGPT and ChatGPT returns a list with the conflict level of each game.
  - ChatGPT has no information whatsoever about stuff that happened after January 2022, including board games released since then. Therefore, we send information (description, mechanics etc) about these more recent games to ChatGPT and ask it to guess the conflict level.
- Finally, we have all the information we need. The tool now generates the CSV file and downloads it.
- All data that was resource-intensive to get (everything that did not come directly from the BGG XML API, that is descriptions and conflict level) is added to the "cache".
  - The tool adds this data to the cache object and sends the updated cache object to the proxy-server.js. The proxy-server.js replaces the old cache object in the file cache.js with the updated cache object.

## A word about configuration

Lots of stuff that should probably not be hard coded currently still is. If you want to change something, you can simply do this directly in the code of the file `src/index.js`. For example:

- If you want to change the way the BGG information is interpretated, just change the function getDetailedDataForGames()
- If you want to change which data is included in the CSV file, just change the structure in the function createCsv()
