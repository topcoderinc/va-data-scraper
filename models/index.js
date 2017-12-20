'use strict';

/*
 * Copyright (c) 2017 Topcoder, Inc. All rights reserved.
 */

/*
 * Sequelize models
 */
const Sequelize = require('sequelize');
const config = require('config');

// initialize database connection
const sequelize = new Sequelize(config.dbConfig.db_url, {
  logging: config.logLevel === 'debug',
  operatorsAliases: Sequelize.Op,
  native: 'true'

});

// Import models
const Veteran = require('./Veteran')(sequelize, Sequelize);
const Cemetery = require('./Cemetery')(sequelize, Sequelize);
const Kin = require('./Kin')(sequelize, Sequelize);
const Branch = require('./Branch')(sequelize, Sequelize);
const War = require('./War')(sequelize, Sequelize);
const Rank = require('./Rank')(sequelize, Sequelize);
const Burial = require('./Burial')(sequelize, Sequelize);

// Create associations
Veteran.hasOne(Burial, { as: 'burial', foreignKey: 'burial_id', targetKey: 'd_id' });
Veteran.hasOne(Kin, { as: 'kin', foreignKey: 'kin_id', targetKey: 'v_id' });
Burial.belongsTo(Cemetery, { as: 'cemetery', foreignKey: 'cem_id' });

Veteran.belongsToMany(Branch, { through: 'VeteranBranch', as: 'branches' });
Veteran.belongsToMany(War, { through: 'VeteranWar', as: 'wars' });
Veteran.belongsToMany(Rank, { through: 'VeteranRank', as: 'ranks' });

module.exports = {
  Veteran,
  Cemetery,
  Kin,
  Branch,
  War,
  Rank,
  Burial,
  sequelize,
  syncDB: force => sequelize.sync({ force })
};
