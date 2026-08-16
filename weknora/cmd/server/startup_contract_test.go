package main

import "testing"

func TestResolveStartupContractFailsBeforeRuntimeForRevisionOrRedisMismatch(t *testing.T) {
	const sha = "0123456789abcdef0123456789abcdef01234567"
	values := map[string]string{
		"WEKNORA_RUNTIME_ROLE":        "web",
		"WEKNORA_PRODUCTION_REVISION": sha,
		"REDIS_ADDR":                  "redis:6379",
	}
	getenv := func(name string) string { return values[name] }
	contract, err := resolveStartupContract(getenv, sha)
	if err != nil || contract.Revision != sha {
		t.Fatalf("valid contract = (%+v,%v)", contract, err)
	}
	delete(values, "REDIS_ADDR")
	if _, err := resolveStartupContract(getenv, sha); err == nil {
		t.Fatal("Redis-less web contract should fail closed")
	}
	values["REDIS_ADDR"] = "redis:6379"
	if _, err := resolveStartupContract(getenv, "1123456789abcdef0123456789abcdef01234567"); err == nil {
		t.Fatal("revision mismatch should fail closed")
	}
}
