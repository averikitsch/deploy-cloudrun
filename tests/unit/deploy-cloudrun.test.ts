/*
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect } from 'chai';
import 'mocha';
import * as sinon from 'sinon';
import * as core from '@actions/core';
import * as setupGcloud from 'setup-google-cloud-sdk';
// import * as setupGcloud from '../../setupGcloudSDK/dist/index';
import { run } from '../../src/deploy-cloudrun';

/* eslint-disable @typescript-eslint/camelcase */
// These are mock data for github actions inputs, where camel case is expected.
const fakeInputs: { [key: string]: string } = {
  image: 'gcr.io/cloudrun/hello',
  service: '',
  metadata: '',
  credentials: '',
  project_id: '',
  env_vars: '',
  source: '',
  suffix: '',
  tag: '',
  no_traffic: '',
  revision_traffic: '',
  tag_traffic: ''
};
/* eslint-enable @typescript-eslint/camelcase */

function getInputMock(name: string): string {
  return fakeInputs[name];
}

const credentials = process.env.TEST_DEPLOY_CLOUDRUN_CREDENTIALS;
const project = process.env.TEST_DEPLOY_CLOUDRUN_PROJECT;
const region = 'us-central1';
const image = 'gcr.io/cloudrun/hello';
const name = `test-${Math.round(Math.random() * 100000)}`; // Cloud Run currently has name length restrictions

describe('#run', function() {
  beforeEach(async function() {
    this.stubs = {
      getInput: sinon.stub(core, 'getInput').callsFake(getInputMock),
      exportVariable: sinon.stub(core, 'exportVariable'),
      setFailed: sinon.stub(core, 'setFailed'),
      installGcloudSDK: sinon.stub(setupGcloud, 'installGcloudSDK'),
      authenticateGcloudSDK: sinon.stub(setupGcloud, 'authenticateGcloudSDK'),
      isInstalled: sinon.stub(setupGcloud, 'isInstalled').returns(false),
      setProject: sinon.stub(setupGcloud, 'setProject'),
      setProjectWithKey: sinon.stub(setupGcloud, 'setProjectWithKey'),
      installComponent: sinon.stub(setupGcloud, 'installComponent')
      // parseServiceAccountKey: sinon.stub(setupGcloud, 'parseServiceAccountKey'),
      // toolCacheFind: sinon.stub(toolCache, 'find').returns('/'),
      // writeFile: sinon.stub(fs, 'writeFile'),
      // env: sinon.stub(process, 'env').value({ GITHUB_PATH: '/' }),
    };
  });

  afterEach(function() {
    Object.keys(this.stubs).forEach((k) => this.stubs[k].restore());
  });
  // it('initializes with JSON creds', function() {
  //   const client = new CloudRun(region, {
  //     credentials: `{"foo":"bar"}`,
  //     projectId: 'test',
  //   });
  //   expect(client.auth.jsonContent).eql({ foo: 'bar' });
  // });

  // it('initializes with ADC', async function() {
  //   if (
  //     !process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  //     !process.env.GCLOUD_PROJECT
  //   ) {
  //     this.skip();
  //   }
  //   const client = new CloudRun(region);
  //   expect(client.auth.jsonContent).eql(null);
  //   const auth = (await client.getAuthClient()) as JWT;
  //   expect(auth.key).to.not.eql(undefined);
  // });

  // if (!credentials) {
  //   this.skip();
  // }
  it('sets the project ID if provided', async function() {
    this.stubs.getInput.withArgs('project_id').returns('test');
    await run();
    expect(this.stubs.setProject.withArgs('test').callCount).to.eq(1);
  });

  it('does not set the project ID if not provided', async function() {
    this.stubs.getInput.withArgs('project_id').returns('');
    await run();
    expect(this.stubs.setProject.callCount).to.eq(0);
  });
  it('installs the gcloud SDK if it is not already installed', async function() {
    this.stubs.isInstalled.returns(false);
    await run();
    expect(this.stubs.installGcloudSDK.callCount).to.eq(1);
  });
  it('uses the cached gcloud SDK if it was already installed', async function() {
    this.stubs.isInstalled.returns(true);
    await run();
    expect(this.stubs.installGcloudSDK.callCount).to.eq(0);
  });
  it('authenticates if key is provided', async function() {
    this.stubs.getInput.withArgs('credentials').returns('key');
    await run();
    expect(this.stubs.authenticateGcloudSDK.withArgs('key').callCount).to.eq(1);
  });
  it('uses project id from credentials if project_id is not provided', async function() {
    this.stubs.getInput.withArgs('credentials').returns('key');
    this.stubs.getInput.withArgs('project_id').returns('');
    await run();
    expect(this.stubs.setProjectWithKey.withArgs('key').callCount).to.eq(1);
  });
  it('fails if credentials and project_id are not provided', async function() {
    this.stubs.getInput.withArgs('credentials').returns('');
    this.stubs.getInput.withArgs('project_id').returns('');
    await run();
    expect(this.stubs.setFailed.callCount).to.eq(1);
  });
  it('installs beta components with source', async function() {
    this.stubs.getInput.withArgs('source').returns('.');
    await run();
    expect(this.stubs.installComponent.withArgs('beta').callCount).to.eq(1);
  });
  it('installs beta components with metadata', async function() {
    this.stubs.getInput.withArgs('metadata').returns('yaml');
    await run();
    expect(this.stubs.installComponent.withArgs('beta').callCount).to.eq(1);
  });
  it('installs beta components with tag', async function() {
    this.stubs.getInput.withArgs('tag').returns('test');
    await run();
    expect(this.stubs.installComponent.withArgs('beta').callCount).to.eq(1);
  });
  it('installs beta components with tag traffic', async function() {
    this.stubs.getInput.withArgs('tag').returns('test');
    this.stubs.getInput.withArgs('name').returns('service-name');
    await run();
    expect(this.stubs.installComponent.withArgs('beta').callCount).to.eq(1);
  });
  it('fails if tag traffic and revision traffic are provided', async function() {
    this.stubs.getInput.withArgs('revision_traffic').returns('TEST=100');
    this.stubs.getInput.withArgs('tag_traffic').returns('TEST=100');
    await run();
    expect(this.stubs.setFailed.callCount).to.eq(1);
  });
  it('fails if name is not provided with tag traffic', async function() {
    this.stubs.getInput.withArgs('tag_traffic').returns('TEST=100');
    this.stubs.getInput.withArgs('name').returns('service-name');
    await run();
    expect(this.stubs.setFailed.callCount).to.eq(1);
  });
  it('fails if name is not provided with revision traffic', async function() {
    this.stubs.getInput.withArgs('revision_traffic').returns('TEST=100');
    this.stubs.getInput.withArgs('name').returns('service-name');
    await run();
    expect(this.stubs.setFailed.callCount).to.eq(1);
  });
});
