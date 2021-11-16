const URLSearchParams = require('@ungap/url-search-params');
const Sha256 = require('crypto-js/sha256');

const salt = 'Nol0sha>L@wl3ss';
const discordAuthorizeUrl = "https://discord.com/api/oauth2/authorize";
const discordLoginCardTemplate = {
    "type": "AdaptiveCard",
    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
    "version": "1.3",
    "body": [
        {
            "type": "TextBlock",
            "text": "Your Discord account is not yet associated with the server.",
            "wrap": true,
            "horizontalAlignment": "Center",
            "height": "stretch"
        },
        {
            "type": "ActionSet",
            "actions": [
                {
                    "type": "Action.OpenUrl",
                    "url": "",
                    "id": "discordLogin",
                    "title": "Connect you to the discord"
                }
            ]
        },
        {
            "type": "ActionSet",
            "actions": [
                {
                    "type": "Action.Submit",
                    "title": "Disconnect",
                    "style": "positive"
                }
            ]
        }
    ]
};

let playersConnecting = {};
let playersWaiting = {};

on('playerConnecting', (name, setKickReason, deferrals) => {
    deferrals.defer();

    playersConnecting[global.source] = deferrals;
});

on('discordwl:connect', player => {
    let deferrals = playersConnecting[player];

    setTimeout(() => {
        deferrals.update("Check whitelist...");

        let steamIdentifier = null;

        for (let i = 0; i < GetNumPlayerIdentifiers(player); i++) {
            const identifier = GetPlayerIdentifier(player, i);

            if (identifier.includes('steam:')) {
                steamIdentifier = identifier;
            }
        }

        setTimeout(() => {
            if (steamIdentifier === null) {
                deferrals.done("You're not connected to steam.")
            } else {
                exports.ghmattimysql.execute("SELECT discord_id AS discordId FROM steam_discord WHERE steam_id = @steamId", {'@steamId': steamIdentifier}, (result) => { 
                    if (result.length > 0 && result[0].discordId) {
                        let discordId = result[0].discordId;
                        checkDiscordPerms(discordId, deferrals);
                    } else {
                        let hash = Sha256(steamIdentifier + salt);

                        let discordParams = new URLSearchParams({
                            client_id: config.clientId,
                            redirect_uri: config.redirectUri,
                            response_type: 'code',
                            scope: 'identify',
                            state: hash
                        });

                        let discordUrl = `${discordAuthorizeUrl}?${discordParams.toString()}`;
                        let discordLoginCard = discordLoginCardTemplate;
                        discordLoginCard.body[1].actions[0].url = discordUrl;

                        let presentCard = () => {
                            deferrals.presentCard(discordLoginCard, () => {
                                deferrals.done('Discord non connecté.');
                            });
                        };

                        // Prevent connection timeout by refreshing card (FokLawless)
                        presentCard();
                        let presentCardInterval = setInterval(presentCard, 20000);

                        playersWaiting[hash] = {def: deferrals, steamId: steamIdentifier, cardInterval: presentCardInterval};
                    }
                });
            }
        }, 1000);
    }, 10);
})

on('discordwl:register', (hash, discordId) => {
    if (hash in playersWaiting) {
        let playerWaiting = playersWaiting[hash];
        console.log(`Hash ${hash} - Registering player ${playerWaiting.steamId} with discord ${discordId}`);

        let clearPlayer = () => {
            clearInterval(playerWaiting.cardInterval);
            delete playersWaiting[hash];
        };

        if (hash != Sha256(playerWaiting.steamId + salt)) {
            console.warn(`Hash ${hash} - Registration failed : hash doesn't match steamId`);
            clearPlayer();
        }

        registerSteamDiscord(playerWaiting.steamId, discordId, () => {
            console.log(`Hash ${hash} - Registration successful`);
            checkDiscordPerms(discordId, playerWaiting.def)
                    .finally(clearPlayer);
        }, () => {
            console.warn(`Hash ${hash} - Registration failed : DB insertion failed`);
            playerWaiting.def.done("Unable to link your Discord account. Please try again and contact the staff if the problem persists.");
            clearPlayer();
        })
    } else {
        console.warn(`Hash ${hash} is not in playersWaiting (discord: ${discordId})`);
    }
});

function registerSteamDiscord(steamId, discordId, cbSuccess, cbError) {
    exports.ghmattimysql.execute("INSERT INTO steam_discord(`steam_id`, `discord_id`) VALUES (@steamId, @discordId)", {
            '@steamId': steamId,
            '@discordId': discordId
        }, result => {
            if (result) {
                console.log(`Inserted : ${steamId} - ${discordId}`);
                cbSuccess();
            } else {
                console.warn(`Failed insertion : ${steamId} - ${discordId}`);
                cbError();
            }
        });
}
