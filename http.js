const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.get('/discord', (req, res) => {
    if ('code' in req.query && 'state' in req.query) {
        let code = req.query.code;
        let state = req.query.state;

        fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: config.clientId,
                client_secret: config.clientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: config.redirectUri,
                scope: 'identify',
            }),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        })
            .then(res => res.json())
            .then(oauthData => {
                fetch('https://discord.com/api/users/@me', {
                    headers: {
                        authorization: `${oauthData.token_type} ${oauthData.access_token}`,
                    },
                })
                    .then(res => res.json())
                    .then(userData => {
                        let discordId = userData.id;
                        emit('discordwl:register', state, discordId);
                        res.send("Successful connection to Discord. If you have been disconnected from the server, reconnect.");
                    })
                    .catch(err => {
                        res.send("Error 0x02. Try again and contact the staff if the problem persists.");
                        console.warn(err);
                    });
            })
            .catch(err => {
                res.send("Error 0x01. Try again and contact the staff if the problem persists.");
                console.warn(err);
            });
    } else {
        res.send("Don't do that. 😡");
    }
});

app.listen(config.httpPort, () => {
  console.log(`Listening at http://localhost:${config.httpPort}`);
});