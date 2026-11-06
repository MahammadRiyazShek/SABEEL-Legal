import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBackend} from './connection';
test('backend normalization accepts HTTPS and local development only',()=>{assert.equal(normalizeBackend(' https://service.example/ '),'https://service.example');assert.equal(normalizeBackend('http://localhost:3000'),'http://localhost:3000');assert.equal(normalizeBackend(''),'');});
test('reject insecure, credential-bearing and Pages backend URLs',()=>{for(const value of ['javascript:alert(1)','http://remote.example','https://user:secret@example.com','https://example.com/api','https://example.com/?token=secret','https://mahammadriyazshek.github.io/'])assert.throws(()=>normalizeBackend(value));});
