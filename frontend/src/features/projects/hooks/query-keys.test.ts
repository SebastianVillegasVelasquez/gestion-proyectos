import { describe, it, expect } from "vitest";
import { projectKeys, taskKeys } from "./query-keys";

describe("projectKeys", () => {
  it("namespaces lists and details under the same root", () => {
    expect(projectKeys.all).toEqual(["projects"]);
    expect(projectKeys.list()).toEqual(["projects", "list"]);
    expect(projectKeys.detail("p1")).toEqual(["projects", "detail", "p1"]);
  });

  it("nests phases and nodes under the project detail", () => {
    expect(projectKeys.phases("p1")).toEqual(["projects", "detail", "p1", "phases"]);
    expect(projectKeys.nodes("p1")).toEqual(["projects", "detail", "p1", "nodes"]);
  });

  it("produces distinct keys per project id", () => {
    expect(projectKeys.detail("a")).not.toEqual(projectKeys.detail("b"));
  });
});

describe("taskKeys", () => {
  it("keys tasks by project and node", () => {
    expect(taskKeys.byNode("p1", "n1")).toEqual(["tasks", "node", "p1", "n1"]);
  });

  it("keys dependencies by project and task", () => {
    expect(taskKeys.dependencies("p1", "t1")).toEqual(["tasks", "deps", "p1", "t1"]);
  });
});
