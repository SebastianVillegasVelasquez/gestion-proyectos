import { describe, it, expect } from "vitest";
import { projectKeys, taskKeys } from "./query-keys";

describe("projectKeys", () => {
  it("namespaces lists and details under the same root", () => {
    expect(projectKeys.all).toEqual(["projects"]);
    expect(projectKeys.list()).toEqual(["projects", "list"]);
    expect(projectKeys.detail("p1")).toEqual(["projects", "detail", "p1"]);
  });

  it("nests the work tree and node types under the project detail", () => {
    expect(projectKeys.tree("p1")).toEqual(["projects", "detail", "p1", "tree"]);
    expect(projectKeys.nodeTypes("p1")).toEqual(["projects", "detail", "p1", "node-types"]);
  });

  it("produces distinct keys per project id", () => {
    expect(projectKeys.detail("a")).not.toEqual(projectKeys.detail("b"));
  });
});

describe("taskKeys", () => {
  it("keys tasks by project", () => {
    expect(taskKeys.byProject("p1")).toEqual(["tasks", "project", "p1"]);
  });

  it("keys dependencies by task", () => {
    expect(taskKeys.dependencies("t1")).toEqual(["tasks", "deps", "t1"]);
  });
});
