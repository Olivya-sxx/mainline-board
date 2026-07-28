"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Task = {
  id: string;
  title: string;
  next: string;
  status: "current" | "paused" | "done";
  parentId?: string;
};

type Project = { id: string; name: string; goal: string };

type Board = { projects: Project[]; tasks: (Task & { projectId: string })[]; activeTaskId: string; activeProjectId: string };

const initialBoard: Board = {
  projects: [{ id: "p1", name: "我的总线", goal: "让每件正在做的事都有清楚的下一步" }],
  tasks: [
    {
      id: "t1",
      title: "建立主线看板",
      next: "把你真实正在做的一件事写进来",
      status: "current", projectId: "p1",
    },
  ],
  activeTaskId: "t1", activeProjectId: "p1",
};

const storageKey = "mainline-board-v2";

type ProjectTask = Task & { projectId: string };

function id() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function RouteTree({ task, tasks, currentId, collapsedIds, onSelect, onToggle }: { task: ProjectTask; tasks: ProjectTask[]; currentId: string; collapsedIds: string[]; onSelect: (id: string) => void; onToggle: (id: string) => void }) {
  const children = tasks.filter((item) => item.parentId === task.id);
  const isCurrent = task.id === currentId;
  const isDone = task.status === "done";
  const isCollapsed = collapsedIds.includes(task.id);
  return (
    <li className={isDone ? "is-done" : ""}>
      <div className="route-row">
        {children.length > 0 && <button className="collapse-button" aria-label={isCollapsed ? "展开下级任务" : "折叠下级任务"} onClick={() => onToggle(task.id)}>{isCollapsed ? "+" : "−"}</button>}
        <button className={`route-node ${isCurrent ? "is-current" : ""}`} onClick={() => onSelect(task.id)}>
          {isDone && <b aria-label="已完成">✓</b>}<span>{task.title}</span>{isCurrent && <em>你在这里</em>}
        </button>
      </div>
      {children.length > 0 && !isCollapsed && <ul>{children.map((child) => <RouteTree key={child.id} task={child} tasks={tasks} currentId={currentId} collapsedIds={collapsedIds} onSelect={onSelect} onToggle={onToggle} />)}</ul>}
    </li>
  );
}

export default function Home() {
  const [board, setBoard] = useState<Board>(initialBoard);
  const [ready, setReady] = useState(false);
  const [showBranch, setShowBranch] = useState(false);
  const [showProject, setShowProject] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) setBoard(JSON.parse(saved));
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(storageKey, JSON.stringify(board));
  }, [board, ready]);

  const current = board.tasks.find((task) => task.id === board.activeTaskId) ?? board.tasks[0];
  const project = board.projects.find((item) => item.id === board.activeProjectId) ?? board.projects[0];
  const branches = useMemo(
    () => board.tasks.filter((task) => task.parentId === current?.id && task.status !== "done"),
    [board.tasks, current?.id],
  );
  const projectTasks = board.tasks.filter((task) => task.projectId === board.activeProjectId);
  const routeRoots = projectTasks.filter((task) => !task.parentId || !projectTasks.some((candidate) => candidate.id === task.parentId));
  const parentTask = current?.parentId ? board.tasks.find((task) => task.id === current.parentId) : undefined;

  function setCurrent(taskId: string) {
    const ancestors: string[] = [];
    let parentId = board.tasks.find((task) => task.id === taskId)?.parentId;
    while (parentId) {
      ancestors.push(parentId);
      parentId = board.tasks.find((task) => task.id === parentId)?.parentId;
    }
    setCollapsedIds((old) => old.filter((id) => !ancestors.includes(id)));
    setBoard((old) => ({
      ...old,
      activeTaskId: taskId,
      tasks: old.tasks.map((task) => ({ ...task, status: task.id === taskId ? "current" : task.status === "current" ? "paused" : task.status })),
    }));
  }

  function toggleCollapsed(taskId: string) {
    setCollapsedIds((old) => old.includes(taskId) ? old.filter((id) => id !== taskId) : [...old, taskId]);
  }

  function switchProject(projectId: string) {
    const task = board.tasks.find((item) => item.projectId === projectId && item.status === "current") ?? board.tasks.find((item) => item.projectId === projectId);
    if (!task) return;
    setBoard((old) => ({ ...old, activeProjectId: projectId, activeTaskId: task.id }));
  }

  function finishAndReturn(taskId: string, parentId: string) {
    setBoard((old) => ({
      ...old,
      activeTaskId: parentId,
      tasks: old.tasks.map((task) => task.id === taskId ? { ...task, status: "done" } : task.id === parentId ? { ...task, status: "current" } : task.status),
    }));
  }

  function updateCurrent(value: string) {
    setBoard((old) => ({
      ...old,
      tasks: old.tasks.map((task) => task.id === old.activeTaskId ? { ...task, next: value } : task),
    }));
  }

  function routeMarkdown() {
    function taskLine(task: ProjectTask, depth: number): string[] {
      const mark = task.status === "done" ? "x" : " ";
      const currentMark = task.id === current.id ? " ← 你在这里" : "";
      const children = projectTasks.filter((item) => item.parentId === task.id);
      return [`${"  ".repeat(depth)}- [${mark}] ${task.title}${currentMark}`, ...children.flatMap((child) => taskLine(child, depth + 1))];
    }
    return [`# ${project.name}`, `> 目标：${project.goal || "未填写"}`, "", ...routeRoots.flatMap((task) => taskLine(task, 0)), ""].join("\n");
  }

  async function copyMarkdown() {
    const markdown = routeMarkdown();
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(markdown);
    } else {
      const area = document.createElement("textarea");
      area.value = markdown;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadMarkdown() {
    const file = new Blob([routeMarkdown()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name || "主线看板"}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function addBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    if (!title || !current) return;
    const task: Task & { projectId: string } = {
      id: id(), title, parentId: current.id, status: "paused",
      projectId: board.activeProjectId,
      next: "",
    };
    setBoard((old) => ({ ...old, tasks: [...old.tasks, task] }));
    setShowBranch(false);
  }

  function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    if (!name) return;
    const projectId = id();
    const newProject = { id: projectId, name, goal: String(form.get("goal") || "").trim() };
    const firstTask = { id: id(), projectId, title: String(form.get("task") || "").trim() || "确定第一步", next: "写下现在要做的第一步", status: "current" as const };
    setBoard((old) => ({ ...old, projects: [...old.projects, newProject], tasks: [...old.tasks.map((task) => task.status === "current" ? { ...task, status: "paused" as const } : task), firstTask], activeProjectId: projectId, activeTaskId: firstTask.id }));
    setShowProject(false);
  }

  if (!ready || !current) return null;

  return (
    <main>
      <header className="topbar">
        <div><p className="eyebrow">主线看板</p><h1>你现在在这里</h1></div>
        <div className="project-actions"><button className="text-button" onClick={copyMarkdown}>{copied ? "已复制" : "复制 Markdown"}</button><button className="text-button" onClick={downloadMarkdown}>下载 .md</button><select aria-label="切换项目" value={project.id} onChange={(e) => switchProject(e.target.value)}>{board.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="text-button" onClick={() => setShowProject(true)}>+ 新项目</button></div>
      </header>

      <section className="orientation" aria-label="当前位置">
        <div><span>项目</span><strong>{project.name}</strong></div>
        <div><span>要去哪里</span><strong>{project.goal || "写下这个项目最终想完成什么"}</strong></div>
      </section>

      <section className="current-card">
        <p className="eyebrow">{current.parentId ? "这件事来自上一条线" : "当前任务 · 只保留一个"}</p>
        <h2>{current.title}</h2>
        <label className="next">我现在只做这一步<textarea value={current.next} onChange={(e) => updateCurrent(e.target.value)} /></label>
        {current.parentId && parentTask && <button type="button" className="return-button" onClick={() => finishAndReturn(current.id, parentTask.id)}>完成并回到「{parentTask.title}」</button>}
      </section>

      <section className="path" aria-label="任务路线">
        <p className="eyebrow">你的路线</p>
        <p className="route-note">每件小事都能沿着“来自”往上追；点 − 可收起一整支路线。</p>
        {routeRoots.length > 0 && <ul className="route-tree">{routeRoots.map((task) => <RouteTree key={task.id} task={task} tasks={projectTasks} currentId={current.id} collapsedIds={collapsedIds} onSelect={setCurrent} onToggle={toggleCollapsed} />)}</ul>}
      </section>

      <section className="branches">
        <div className="section-heading"><div><p className="eyebrow">从这里长出的任务</p><h2>它们都记得自己来自哪里</h2></div><button className="outline-button" onClick={() => setShowBranch(true)}>+ 新任务</button></div>
        {branches.length === 0 ? <p className="empty">暂时没有从这里长出的任务。</p> : (
          <div className="branch-list">{branches.map((branch) => <article className="branch" key={branch.id}><div><p>{branch.title}</p><small>{branch.next}</small></div><button onClick={() => setCurrent(branch.id)}>去处理</button></article>)}</div>
        )}
      </section>

      {showBranch && <dialog open className="dialog"><form method="dialog" onSubmit={addBranch}><div className="section-heading"><h2>从「{current.title}」长出新任务</h2><button type="button" className="close" onClick={() => setShowBranch(false)}>×</button></div><label>这件事叫什么<input name="title" autoFocus placeholder="例如：整理另一个项目的资料" /></label><button className="primary-button" type="submit">记下来源关系</button></form></dialog>}
      {showProject && <dialog open className="dialog"><form method="dialog" onSubmit={addProject}><div className="section-heading"><h2>新项目</h2><button type="button" className="close" onClick={() => setShowProject(false)}>×</button></div><label>项目名称<input name="name" autoFocus placeholder="例如：旅行计划" /></label><label>最终想完成什么<input name="goal" placeholder="例如：确定路线并订好行程" /></label><label>这个项目的第一步<input name="task" placeholder="例如：列出行程约束" /></label><button className="primary-button" type="submit">建立项目并进入</button></form></dialog>}
    </main>
  );
}
