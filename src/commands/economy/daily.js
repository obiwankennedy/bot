/*
Copyright 2018 Jonah Snider

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const { Command } = require('discord.js-commando');
const config = require('../../config');
const database = require('../../util/database');
const moment = require('moment');
const logger = require('../../util/logger').scope('command', 'daily');
const DBL = require('dblapi.js');
const { oneLine } = require('common-tags');
const ms = require('ms');

module.exports = class DailyCommand extends Command {
  constructor(client) {
    super(client, {
      name: 'daily',
      group: 'economy',
      memberName: 'daily',
      description: `Collect your daily ${config.currency.plural}.`,
      aliases: ['dailies'],
      throttling: {
        usages: 1,
        duration: 3
      }
    });
  }

  async run(msg) {
    try {
      msg.channel.startTyping();

      // Initialize variables
      const oldTime = await database.getDailyUsed(msg.author.id);
      const currentTime = msg.createdTimestamp;
      const dbl = new DBL(config.botListTokens['discordbots.org']);
      const dblData = await Promise.all([
        dbl
          .hasVoted(msg.author.id)
          .catch(error => {
            logger.error('Error in discordbots.org vote checking', error.stack);
            return false;
          }),
        dbl.isWeekend()
      ]);

      // 23 hours because it's better for users to have some wiggle room
      const fullDay = ms('23 hours');
      const waitDuration = moment.duration(oldTime - currentTime + fullDay).humanize();

      let payout = 1000;
      let note;

      logger.debug(`DBL vote status for ${msg.author.tag}: ${dblData[0]}${dblData[1] ? ' (weekend)' : ''}`);

      let multiplier = 1;

      if (dblData[0] && dblData[1]) {
        payout *= 4;
        multiplier *= 4;
        // eslint-disable-next-line max-len
        note = `You got ${multiplier}x your payout from voting for ${this.client.user} today and during the weekend. Use ${msg.anyUsage('vote')} to vote once per day.`;
      } else if (dblData[0]) {
        payout *= 2;
        multiplier *= 2;
        // eslint-disable-next-line max-len
        note = `You got double your payout from voting for ${this.client.user} today. Use ${msg.anyUsage('vote')} to vote once per day.`;
      } else {
        // eslint-disable-next-line max-len
        note = `You can double your payout from voting for ${this.client.user} each day and quadruple it for voting on the weekend. Use ${msg.anyUsage('vote')} to vote once per day.`;
      }

      if (config.patrons[msg.author.id] && config.patrons[msg.author.id].basic === true) {
        payout *= 2;
        multiplier *= 2;

        note = `You got ${multiplier}x your payout from voting for being a basic tier (or higher) patron.`;
      }

      if (oldTime) {
        logger.debug(`Old timestamp: ${new Date(oldTime)} (${oldTime})`);
      } else {
        logger.debug('No date in records (undefined)');
      }

      logger.debug(`Current timestamp: ${new Date(currentTime)} (${currentTime})`);

      if (!oldTime || oldTime + fullDay < currentTime) {
        // Pay message author their daily and save the time their daily was used
        await Promise.all([
          database.balances.increase(msg.author.id, payout),
          database.setDailyUsed(msg.author.id, currentTime)
        ]);
        // Pay Dice the same amount to help handle the economy
        database.balances.increase(this.client.user.id, payout);

        // Daily not collected in one day
        const message = oneLine`You were paid ${payout.toLocaleString()} ${config.currency.plural}.
        Your balance is now ${(await database.balances.get(msg.author.id)).toLocaleString()} ${config.currency.plural}.`;
        return msg.reply(`${message}${note ? `\n${note}` : ''}`);
      }
      // Daily collected in a day or less (so, recently)
      return msg.reply(`🕓 You must wait ${waitDuration} before collecting your daily ${config.currency.plural}. Remember to vote each day and get double ${config.currency.plural}. Use ${msg.anyUsage('vote')}.`);
    } finally {
      msg.channel.stopTyping();
    }
  }
};
