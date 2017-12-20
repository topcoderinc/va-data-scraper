'use strict';

/*
 * Copyright (c) 2017 Topcoder, Inc. All rights reserved.
 */

/*
 * Data
 */
const co = require('co');
const _ = require('lodash');
const moment = require('moment');
const { csvHeaders } = require('../constants');
const logger = require('../common/logger');
const {
  Veteran,
  Burial,
  Cemetery,
  Kin,
  Rank,
  Branch,
  War,
  sequelize
} = require('../models');

/**
 * Process file
 * @param {array} file - The input file
 */
function* processFile(file) {
  const totalCount = {
    branches: 0,
    wars: 0,
    veterans: 0
  };

  /**
   * Save ranks recursively
   * @param {number} index - The index of the rank
   * @param {array} ranks - The ranks array
   * @param {sequelize transaction} t - The sequelize transaction
   */
  function* saveRanks(index, ranks, t) {
    const rank = yield Rank.count({ where: { value: ranks[index].value } });
    if (rank === 0) yield Rank.create(ranks[index], { transaction: t });
    return index < ranks.length - 1 ? yield saveRanks(index + 1, ranks, t) : true;
  }

  /**
   * Save branches recursively
   * @param {number} index - the row index
   * @param {array} branches - The branches array
   * @param {sequelize transaction} t - The sequelize transaction
   */
  function* saveBranches(index, branches, t) {
    const branchCount = yield Branch.count({ where: { value: branches[index].value } });
    if (branchCount === 0) {
      yield Branch.create(branches[index], { transaction: t });
      totalCount.branches += 1;
    }
    return index < branches.length - 1 ? yield saveBranches(index + 1, branches, t) : true;
  }

  /**
   * Save wars recursively
   * @param {number} index - the row index
   * @param {array} wars - The wars array
   * @param {sequelize transaction} t - The sequelize transaction
   */
  function* saveWars(index, wars, t) {
    const warCount = yield War.count({ where: { value: wars[index].value } });
    if (warCount === 0) {
      yield War.create(wars[index], { transaction: t });
      totalCount.wars += 1;
    }
    return index < wars.length - 1 ? yield saveWars(index + 1, wars, t) : true;
  }

  /**
    * Read each row recursively.
    */
  function* processRow() {
    const row = file.shift();
    // Dataset for foreign addresses has an extra column so we need to skip it
    const hasExtraColumn = row.length - 1 > csvHeaders.length;
    // ignore header & rows with missing attributes
    if (_.intersection(row, csvHeaders).length < csvHeaders.length && _validate(row, hasExtraColumn)) {
      totalCount.veterans += 1;
      const cemeteryId = (`${row[9]}-${row[10]}-${row[hasExtraColumn ? 13 : 12]}`).toLowerCase();
      const veteranId = (`${row[0]}-${row[2]}-${_formatDate(row[4])}-${_formatDate(row[5])}-${cemeteryId}`).toLowerCase();
      // Use transaction
      yield sequelize.transaction(t => co(function* () {
        // Create/Update cemetery
        const cemetery = yield Cemetery.findOne({ where: { cem_id: cemeteryId } });
        const cemeteryObj = _removeEmpty({
          cem_id: cemeteryId,
          cem_name: row[9],
          cem_addr_one: row[10],
          cem_addr_two: hasExtraColumn ? null : row[11],
          cem_url: hasExtraColumn ? null : row[15],
          cem_phone: row[hasExtraColumn ? 11 : 15],
          city: row[hasExtraColumn ? 12 : 12],
          state: row[hasExtraColumn ? 12 : 13],
          zip: row[hasExtraColumn ? 15 : 14]
        });
        if (!cemetery) {
          yield Cemetery.create(cemeteryObj, { transaction: t });
        } else if (!_.isEqual(cemeteryObj, cemetery.toJSON())) {
          // Update the existing cemetery if there's any difference
          _.extend(cemetery, cemeteryObj);
          yield cemetery.save({ transaction: t });
        }

        // Create/Update burial information
        const burial = yield Burial.findOne({ where: { d_id: veteranId } });
        const burialObj = _removeEmpty({
          d_id: veteranId,
          cem_id: cemeteryId,
          section_id: row[6],
          row_num: row[7],
          site_num: row[8]
        });
        if (!burial) {
          yield Burial.create(burialObj, { transaction: t });
        } else if (!_.isEqual(burial.toJSON(), burialObj)) {
          // Update the existing burial info if there's any difference
          _.extend(burial, burialObj);
          yield burial.save({ transaction: t });
        }

        // Create/Update kin
        const kin = yield Kin.findOne({ where: { v_id: veteranId } });
        const kinObj = _removeEmpty({
          v_id: veteranId,
          relationship: row[hasExtraColumn ? 18 : 17],
          v_first_name: row[hasExtraColumn ? 19 : 18],
          v_mid_name: row[hasExtraColumn ? 20 : 19],
          v_last_name: row[hasExtraColumn ? 21 : 20],
          v_suffix: row[hasExtraColumn ? 22 : 21]
        });
        if (!kin) {
          yield Kin.create(kinObj, { transaction: t });
        } else if (!_.isEqual(kin.toJSON(), kinObj)) {
          // Update the existing kin info if there's any difference
          _.extend(kin, kinObj);
          yield kin.save({ transaction: t });
        }

        // Create/Update veteran
        const veteran = yield Veteran.findOne({ where: { d_id: veteranId } });
        const veteranObj = _removeEmpty({
          d_id: veteranId,
          d_first_name: row[0],
          d_mid_name: row[1],
          d_last_name: row[2],
          d_birth_date: _formatDate(row[4]),
          d_death_date: _formatDate(row[5]),
          burial_id: veteranId,
          kin_id: veteranId
        });
        if (!veteran) {
          const newVeteran = yield Veteran.create(veteranObj);
          // Create ranks
          const ranks = [];
          _.each(row[hasExtraColumn ? 24 : 23].split(', '), (v) => {
            if (!_.isEmpty(_.trim(v))) {
              if (_.indexOf(ranks, v) === -1) ranks.push({ value: _.trim(v) });
            }
          });
          if (ranks.length > 0) yield saveRanks(0, _.uniqBy(ranks, 'value'), t);
          yield newVeteran.setRanks(_.uniq(_.map(ranks, rank => rank.value)), { transaction: t });

          // Branches
          const branches = [];
          _.each(row[hasExtraColumn ? 23 : 22].split(', '), (v) => {
            if (!_.isEmpty(_.trim(v))) {
              if (_.indexOf(branches, v) === -1) branches.push({ value: _.trim(v) });
            }
          });
          if (branches.length > 0) yield saveBranches(0, _.uniqBy(branches, 'value'), t);
          yield newVeteran.setBranches(_.uniq(_.map(branches, branch => branch.value)), { transaction: t });

          // Wars
          const wars = [];
          _.each(row[hasExtraColumn ? 25 : 24].split(', '), (v) => {
            if (!_.isEmpty(_.trim(v))) {
              if (_.indexOf(wars, v) === -1) wars.push({ value: _.trim(v) });
            }
          });
          if (wars.length > 0) yield saveWars(0, _.uniqBy(wars, 'value'), t);
          yield newVeteran.setWars(_.uniq(_.map(wars, war => war.value)), { transaction: t });
        } else if (!_.isEqual(veteran.toJSON(), veteranObj)) {
          // Lookup data is not updated as it will never change
          _.extend(veteran, veteranObj);
          yield veteran.save({ transaction: t });
        }
      }));
    }
    return _.isEmpty(file) ? true : yield processRow();
  }

  yield processRow();
  logger.info(`Imported ${totalCount.veterans} veterans in ${totalCount.branches} branches in ${totalCount.wars} wars.`);
}

/**
 * Helper function that validates that a row has all required information
 * @param {array} - row - The row
 * @param {boolean} - hasExtraColumn - Indicate if the row has extra column
 */
function _validate(row, hasExtraColumn) {
  return (
    !_.isEmpty(_.trim(row[0])) // d_first_name
    && !_.isEmpty(_.trim(row[2])) // d_last_name
    && !_.isEmpty(_.trim(row[4])) // d_birth_date
    && !_.isEmpty(_.trim(row[5])) // d_death_date
    && !_.isEmpty(_.trim(row[5])) // d_death_date
    && !_.isEmpty(_.trim(row[9])) // cem_name
    && !_.isEmpty(_.trim(row[10])) // cem_addr_one
    && !_.isEmpty(_.trim(row[hasExtraColumn ? 13 : 12])) // city
    && !_.isEmpty(_.trim(row[hasExtraColumn ? 18 : 17])) // relationship
    && !_.isEmpty(_.trim(row[hasExtraColumn ? 19 : 18])) // v_first_name
    && !_.isEmpty(_.trim(row[hasExtraColumn ? 21 : 20])) // v_last_name
  );
}

/**
 * Helper function that removes empty attribues from object
 * @param {object} obj - The object
 */
function _removeEmpty(obj) {
  const cleanedObj = {};
  _.each(obj, (value, key) => {
    if (!_.isEmpty(_.trim(value))) {
      cleanedObj[key] = _.trim(value);
    }
  });
  return cleanedObj;
}

/**
 * Parse date.
 * @param {string} d - the string
 */
function _formatDate(d) {
  if (!d || d.length === 0) return null;
  const date = moment.utc(d, 'MM/DD/YYYY');
  if (!date.isValid()) return null;
  return date.toDate();
}

module.exports = {
  processFile
};
