const { Client, Intents } = require('discord.js');

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS] });

client.login(config.token);

client.once('ready', () => {
    console.log("Discord Client ready");
});

function checkDiscordPerms(discordId, deferrals) {
    // Getting Discord Guild (FokLawless)
    let guild = client.guilds.resolve(config.guild);
    
    // Checking if member exists in guild 
    return guild.members.fetch({user: discordId, force: true})
        .then(member => {
            let isWhitelisted = false;
            
            if (config.checkRole) {
                // Checking if member has one of the whitelisted roles (FokLawless)
                config.roles.forEach(role => {
                    if (member.roles.cache.has(role)) {
                        isWhitelisted = true;
                    }
                });
            }

            if (config.checkRole && !isWhitelisted) {
                deferrals.done("You're not whitelist");
            } else {
                deferrals.done();
            }
        })
        .catch(err => {
            deferrals.done("You're not whitelist connected : https://yourdiscord");
        });
}