const {
    Command,
} = require('discord.js-commando');
const rules = require('../../rules');
const diceAPI = require('../../diceAPI');
const moment = require('moment');
const winston = require('winston');

module.exports = class DailyCommand extends Command {
    constructor(client) {
        super(client, {
            name: 'daily',
            group: 'economy',
            memberName: 'daily',
            description: `Collect your daily ${rules.currencyPlural}`,
            aliases: ['dailies'],
            examples: ['daily'],
            throttling: {
                usages: 1,
                duration: 3,
            },
            guildOnly: true,
        });
    }

    async run(msg) {
        // Initialize variables
        const oldTime = await diceAPI.getDailyUsed(msg.author.id);
        const currentTime = msg.createdTimestamp;
        // 23 hours because it's better for users to have some wiggle room
        const fullDay = 82800000;
        const millisecondsUntil = (oldTime - currentTime) + fullDay;
        const waitDuration = moment.duration(millisecondsUntil);

        const inviter = rules.rewardRoles[0];
        const backer = rules.rewardRoles[1];
        const recruiter = rules.rewardRoles[2];
        const affiliate = rules.rewardRoles[3];

        let payout = 1000;
        let message;

        // Bonuses for referring users
        if (msg.member.roles.has(affiliate.id) && msg.guild.id === '388366947689168897') {
            payout = payout * affiliate.multiplier;
            message = 'You got double the regular amount for being an **affiliate** from inviting 25 users';
        }
        else if (msg.member.roles.has(recruiter.id) && msg.guild.id === '388366947689168897') {
            payout = payout * recruiter.multiplier;
            message = 'You got a 75% bonus for being a **recruiter** from inviting ten users';
        }
        else if (msg.member.roles.has(backer.id) && msg.guild.id === '388366947689168897') {
            payout = payout * backer.multiplier;
            message = 'You got a 25% bonus for being a **backer** from inviting five users';
        }
        else if (msg.member.roles.has(inviter.id) && msg.guild.id === '388366947689168897') {
            payout = payout * inviter.multiplier;
            message = 'You got a 10% bonus for being a **inviter** from inviting one user';
        }

        winston.debug(`@${msg.author.username} You must wait ${waitDuration.hours()} hours and ${waitDuration.minutes()} minutes before collecting your daily ${rules.currencyPlural}.`);
        winston.debug(`Old timestamp: ${new Date(oldTime)} (${oldTime})`);
        winston.debug(`Current timestamp: ${new Date(currentTime)} (${currentTime})`);

        if (oldTime + fullDay < currentTime || oldTime === false) {
            if (oldTime === false) winston.verbose('Old timestamp was returned as false, meaning empty in the database.');
            await diceAPI.increaseBalance(msg.author.id, payout);
            await diceAPI.setDailyUsed(msg.author.id, currentTime);
            // Daily not collected in one day
            if (message) {
                return msg.reply(`You were paid ${payout} ${rules.currencyPlural}\n${message}`);
            }
            else {
                return msg.reply(`You were paid ${payout} ${rules.currencyPlural}`);
            }
        }
        // Daily collected in a day or less
        else if (waitDuration.hours() === 0) {
            return msg.reply(`🕓 You must wait ${waitDuration.minutes()} minutes before collecting your daily ${rules.currencyPlural}.`);
        }
        else {
            return msg.reply(`🕓 You must wait ${waitDuration.hours()} hours and ${waitDuration.minutes()} minutes before collecting your daily ${rules.currencyPlural}.`);
        }
    }
};