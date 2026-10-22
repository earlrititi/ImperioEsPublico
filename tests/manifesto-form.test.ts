import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";

test("manifesto popup requests name and email without a surname field or submit dependency",()=>{
  const source=readFileSync("src/components/Services.jsx","utf8");
  assert.match(source,/name="firstName"/);
  assert.match(source,/name="email"/);
  assert.doesNotMatch(source,/name="lastName"|manifestLastName|setManifestLastName|family-name/);
  assert.match(source,/manifestPrivacy && manifestFirstName\.trim\(\)/);
});

test("standalone manifesto popup also works without surnames",()=>{
  const source=readFileSync("src/pages/manifiesto.astro","utf8");
  assert.match(source,/name="firstName"/);
  assert.match(source,/name="email"/);
  assert.doesNotMatch(source,/name="lastName"|manifestoLastNameInput|manifesto-last-name|family-name/);
});
