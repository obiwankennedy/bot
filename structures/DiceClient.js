const { CommandoClient } = require('discord.js-commando');
const database = require('../util/database');

class DiceClient extends CommandoClient {
  constructor(options) {
    super(options);

    this.db = database;
    this.blacklist = [];
  }
}

module.exports = DiceClient;
