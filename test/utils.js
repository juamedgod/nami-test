'use strict';

const generateRandomData = require('../index.js').utils.generateRandomData;
const chai = require('chai');
const expect = chai.expect;

const crc32 = require('crc').crc32;
const _ = require('lodash');

describe('#generateRandomData()', function() {
  function getRandomDataCRCs(nelems, options) {
    let i = 0;
    const elements = {};
    while (i < nelems) {
      const data = generateRandomData(options);
      const id = crc32(data).toString(16);
      if (elements.hasOwnProperty(id)) {
        throw new Error(`Got duplicated element`);
      }
      elements[id] = data.length;
      i++;
    }
    return elements;
  }
  function checkRandomDataLength(elements, minSize, maxSize) {
    let nchecks = 0;
    _.each(elements, len => {
      expect(len).to.be.at.least(minSize)
        .and.to.be.at.most(maxSize);
      nchecks++;
    });
    return nchecks;
  }
  it('By defaults, generates random data between 2MB and 5K', function() {
    const maxSize = 2000 * 1024;
    const minSize = 5 * 1024;
    const nchecks = checkRandomDataLength(getRandomDataCRCs(20), minSize, maxSize);
    expect(nchecks).to.be.eql(20);
  });
  it('Allows controlling the data size', function() {
    const size = 1024;
    const elements = getRandomDataCRCs(20, {
      minBytes: size,
      maxBytes: size
    });
    // Ensure the checker works
    expect(_.sample(elements)).to.be.eql(size);
    const nchecks = checkRandomDataLength(elements, size, size);
    expect(nchecks).to.be.eql(20);
  });
});
