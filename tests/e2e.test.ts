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
import { GoogleAuth } from 'google-auth-library';
import * as exec from '@actions/exec';
import * as _ from 'lodash';
import 'mocha';
import { run_v1 } from 'googleapis';
import yaml = require('js-yaml');

describe('E2E tests', function () {
  const {
    PARAMS,
    ANNOTATIONS,
    LABELS,
    ENV,
    SERVICE,
    COUNT,
    REVISION,
    TAG,
    TRAFFIC,
  } = process.env;

  let URL: string;
  let service: run_v1.Schema$Service;
  let toolCommand: string;
  before(async function () {
    if (process.env.URL) {
      URL = process.env.URL;
    } else {
      throw Error('URL not found.');
    }
    toolCommand = 'gcloud';
    if (SERVICE) {
      // get Service yaml
      let output = '';
      const stdout = (data: Buffer): void => {
        output += data.toString();
      };
      const options = {
        listeners: {
          stdout,
        },
      };
      let cmd = [
        'run',
        'services',
        'describe',
        SERVICE,
        '--format',
        'yaml',
        '--platform',
        'managed',
        '--region',
        'us-central1',
      ];
      await exec.exec(toolCommand, cmd, options);
      service = yaml.load(output) as run_v1.Schema$Service;
      if (!service) console.log('no service found');
    }
  });

  it('can make a request', async function () {
    // Requires ADC to be set
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(URL);
    const response = await client.request({ url: URL });
    expect(response.status).to.be.equal(200);
    expect(response.data).to.include('Congrat');
  });

  it('has the correct env vars', function () {
    if (ENV && service) {
      const expected = parseEnvVars(ENV);
      const containers = _.get(service, 'spec.template.spec.containers');
      const actual = containers[0]?.env;
      expect(actual).to.have.lengthOf(expected.length);
      actual.forEach((envVar: run_v1.Schema$EnvVar) => {
        const found = expected.find((expectedEnvVar) =>
          _.isEqual(envVar, expectedEnvVar),
        );
        expect(found).to.not.equal(undefined);
      });
    }
  });

  it('has the correct params', function () {
    if (PARAMS && service) {
      const expected = JSON.parse(PARAMS);
      const actual = _.get(service, 'spec.template.spec');

      if (expected.containerConncurrency) {
        expect(actual.containerConncurrency).to.equal(
          expected.containerConncurrency,
        );
      }
      if (expected.timeoutSeconds) {
        expect(actual.timeoutSeconds).to.equal(expected.timeoutSeconds);
      }
      const actualResources = actual.containers[0].resources;
      if (expected.cpu) {
        expect(actualResources.limits.cpu).to.equal(expected.cpu.toString());
      }
      if (expected.memory) {
        expect(actualResources.limits.memory).to.equal(expected.memory);
      }
    }
  });

  it('has the correct annotations', function () {
    if (ANNOTATIONS && service) {
      const expected = JSON.parse(ANNOTATIONS);
      const actual = _.get(service, 'spec.template.metadata.annotations');

      Object.entries(expected).forEach((annot: object) => {
        const found = Object.entries(actual).find((actualAnnot: object) =>
          _.isEqual(annot, actualAnnot),
        );
        expect(found).to.not.equal(undefined);
      });
    }
  });

  it('has the correct labels', function () {
    if (LABELS && service) {
      const expected = JSON.parse(LABELS);
      const actual = _.get(service, 'spec.template.metadata.labels');

      Object.entries(expected).forEach((label: object) => {
        const found = Object.entries(actual).find((actualLabel: object) =>
          _.isEqual(label, actualLabel),
        );
        expect(found).to.not.equal(undefined);
      });
    }
  });

  it('has the correct revision count', async function () {
    if (COUNT && SERVICE) {
      let output = '';
      const stdout = (data: Buffer): void => {
        output += data.toString();
      };
      const options = {
        listeners: {
          stdout,
        },
        silent: true,
      };
      let cmd = [
        'run',
        'revisions',
        'list',
        '--service',
        SERVICE,
        '--format',
        'json',
      ];
      await exec.exec(toolCommand, cmd, options);
      const revisions = JSON.parse(output);
      expect(revisions.length).to.equal(parseInt(COUNT));
    }
  });

  it('has the correct revision name', function () {
    if (REVISION && service) {
      const actual = _.get(service, 'spec.template.metadata.name');
      expect(REVISION).to.equal(actual);
    }
  });

  it('has the correct tag', function () {
    if (TAG && service) {
      const traffic = _.get(service, 'spec.traffic');
      const actual = traffic.find((rev: run_v1.Schema$TrafficTarget) => {
        return rev['tag'] == TAG;
      });
      expect(TAG).to.equal(actual['tag']);
    }
  });
  it('has the correct traffic', function () {
    if (TAG && TRAFFIC && service) {
      const traffic = _.get(service, 'spec.traffic');
      const tagged = traffic.find((rev: run_v1.Schema$TrafficTarget) => {
        return rev['tag'] == TAG;
      });
      const actual = traffic.find((rev: run_v1.Schema$TrafficTarget) => {
        return rev['revisionName'] == tagged['revisionName'];
      });
      expect(TRAFFIC).to.equal(actual['percent']);
    }
  });

  function parseEnvVars(envVarInput: string): run_v1.Schema$EnvVar[] {
    const envVarList = envVarInput.split(',');
    const envVars = envVarList.map((envVar) => {
      if (!envVar.includes('=')) {
        throw new TypeError(
          `Env Vars must be in "KEY1=VALUE1,KEY2=VALUE2" format, received ${envVar}`,
        );
      }
      const keyValue = envVar.split('=');
      return { name: keyValue[0], value: keyValue[1] };
    });
    return envVars;
  }
});
