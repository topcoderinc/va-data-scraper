'use strict';

/*
 * Copyright (c) 2017 Topcoder, Inc. All rights reserved.
 */

/*
 * War model definition
 */
module.exports = (sequelize, DataTypes) => sequelize.define('War', {
  value: {
    type: DataTypes.STRING,
    allowNull: null,
    primaryKey: true,
    unique: true
  }
}, {
  timestamps: false
});
