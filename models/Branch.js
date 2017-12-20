'use strict';

/*
 * Copyright (c) 2017 Topcoder, Inc. All rights reserved.
 */

/*
 * Branch model definition
 */
module.exports = (sequelize, DataTypes) => sequelize.define('Branch', {
  value: {
    type: DataTypes.STRING,
    allowNull: null,
    primaryKey: true,
    unique: true
  }
}, {
  timestamps: false
});
