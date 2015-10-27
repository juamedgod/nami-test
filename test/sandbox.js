'use strict';

const fs = require('fs-extra');
const Sandbox = require('../index.js').Sandbox;
const chai = require('chai');
const chaiFs = require('chai-fs');
chai.use(chaiFs);
const expect = chai.expect;
const path = require('path');
const _ = require('lodash');

/* eslint-disable no-unused-expressions */

describe('Sandbox', function() {
  let sb = null;
  beforeEach(function() {
    sb = new Sandbox();
  });
  it('Supports providing a root directory', function() {
    const sb1 = new Sandbox(sb.root);
    expect(sb1.root).to.be.equal(sb.root);
  });
  it('Uses a random root dir if not provided', function() {
    const sb1 = new Sandbox();
    const sb2 = new Sandbox();
    expect(sb1.root).to.be.a.directory();
    expect(sb2.root).to.be.a.directory();
    expect(sb1.root).to.not.be.equal(sb2.root);
  });
  describe('#isSandboxed()', function() {
    it('Properly detects if a file is not contained', function() {
      const root = sb.root;
      expect(root).to.be.a.directory();
      _.each({
        [root]: true,
        [`${root}//`]: true,
        [`${root}x`]: false,
        [path.join(root, 'foobar')]: true,
        'sample.txt': false,
        '/tmp/data': false
      }, function(isSandboxed, f) {
        expect(sb.isSandboxed(f)).to.be.eql(isSandboxed);
      });
    });
  });
  describe('#cleanup()', function() {
    const tmpFiles = ['file.txt', 'a/s/d/f/file.txt'];
    function writeFiles(sandbox) {
      const files = [];
      _.each(tmpFiles, f => {
        sandbox.write(f, '');
        const normalizeFile = path.join(sb.root, f);
        expect(normalizeFile).to.be.a.path();
        files.push(normalizeFile);
      });
      return files;
    }
    it('Allows cleaning up on demand', function() {
      const files = writeFiles(sb);
      sb.cleanup();
      _.each(files, f => expect(f).to.not.be.a.path());
      expect(sb.root).to.not.be.a.path();
    });
    it('Cleans on exit', function() {
      const files = writeFiles(sb);
      process.emit('exit');
      _.each(files, f => expect(f).to.not.be.a.path());
      expect(sb.root).to.not.be.a.path();
    });
    it('Throws an error if failed determining if a file exists', function() {
      const files = writeFiles(sb);
      const testFile = files[0];
      fs.chmodSync(testFile, '000');
      expect(() => sb.cleanup()).not.to.throw.exception;
    });
  });
  describe('#write()', function() {
    it('Writes files', function() {
      _.each({
        'a/b/sample.txt': 'asdf',
        'hello.txt': 'world!'
      }, function(data, f) {
        sb.write(f, data);
        const normalizedFile = path.join(sb.root, f);
        expect(normalizedFile).to.have.content(data);
      });
    });
    it('Returns the full path to the written file', function() {
      const tail = 'sample.txt';
      expect(sb.write(tail, '')).to.be.eql(path.join(sb.root, tail));
    });
  });
  describe('#normalize()', function() {
    it('Absolutizes the files path against the sandbox root', function() {
      _.each({
        'a/b/sample.txt': 'asdf',
        'hello.txt': 'world!'
      }, function(data, f) {
        const normalizedFile = path.join(sb.root, f);
        expect(sb.normalize(f)).to.be.eql(normalizedFile);
      });
    });
    it('Sucessive normalization are ignored', function() {
      _.each({
        'a/b/sample.txt': 'asdf',
        'hello.txt': 'world!'
      }, function(data, f) {
        const normalizedFile = path.join(sb.root, f);
        expect(sb.normalize(sb.normalize(f))).to.be.eql(normalizedFile);
      });
    });
  });
  describe('#createFilesFromManifest()', function() {
    const testManifest = {
      sample_dir: {
        'dir': {
          anotherDir: {
            sampleFile: 'Some text'
          }
        },
        fileUsingObject: {contents: 'Some more text', type: 'file', permissions: '666'},
        dirUsingObject: {type: 'directory', permissions: '700'},
        'test.txt': 'echo Line 1\nsleep 0.2\nLine 2\nsleep 0.2\nLine 3',
        'sampleFile': 'Hello World!',
        'sampleLink': [process.execPath]
      }
    };
    function checkFiles(manifest, prefix) {
      const root = prefix ? path.join(sb.root, prefix) : sb.root;
      const files = [];
      const links = [];
      function getTree(m, entrypoint) {
        _.each(m, (value, key) => {
          key = path.join(entrypoint, key);
          files.push(key);
          if (_.isArray(value)) {
            links.push(key);
          } else if (_.isObject(value)) {
            getTree(value, key);
          }
        });
      }
      getTree(manifest, root);
      _.each(files, (f) => expect(f).to.be.a.path);
      _.each(links, (l) => expect(fs.lstatSync(l).isSymbolicLink()).to.be.true);
    }
    it('Create files tree following a provided hash', function() {
      sb.createFilesFromManifest(testManifest);
      checkFiles(testManifest);
    });
    it('Create files tree following a provided hash using a specified prefix', function() {
      const prefix = 'subdir';
      sb.createFilesFromManifest(testManifest, prefix);
      checkFiles(testManifest, prefix);
    });
    it('Throws an error when the manifest is not correct', function() {
      let wrongManifest = {dir: undefined};
      expect(() => sb.createFilesFromManifest(wrongManifest)).to.throw(/Malformed manifest/);
      wrongManifest = {file: {contents: 'Text', type: 'wrong type'}};
      expect(() => sb.createFilesFromManifest(wrongManifest)).to.throw(/Unknown path type/);
    });
  });
  describe('#read()', function() {
    it('Reads files', function() {
      _.each({
        'a/b/sample.txt': 'asdf',
        'hello.txt': 'world!'
      }, function(data, f) {
        const normalizedFile = path.join(sb.root, f);
        fs.mkdirpSync(path.dirname(normalizedFile));
        fs.writeFileSync(normalizedFile, data);
        expect(sb.read(f)).to.be.eql(data);
      });
    });
  });
  describe('#mkdir()', function() {
    const tail = 'test_dir';
    it('Creates directories', function() {
      const fullDir = path.join(sb.root, tail);
      expect(fullDir).to.not.be.a.path();
      sb.mkdir(tail);
      expect(fullDir).to.be.a.directory();
    });
    it('Returns the full path to the created directory', function() {
      expect(sb.mkdir(tail)).to.be.eql(path.join(sb.root, tail));
    });
  });
});
