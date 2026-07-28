"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Task = {
  id: string;
  title: string;
  progress: string;
  next: string;
  status: "current" | "paused" | "done";
  parentId?: string;
};

type Project = { id: string; name: string; goal: string };

type Board = { projects: Project[]; tasks: (Task & { projectId: string })[]; activeTaskId: string; activeProjectId: string };

const initialBoard: Board = {
  projects: [], tasks: [], activeTaskId: "", activeProjectId: "",
};

const storageKey = "mainline-board-v5";

type ProjectTask = Task & { projectId: string };

function restoreBoard(value: unknown): Board {
  if (!value || typeof value !== "object") return initialBoard;
  const saved = value as Partial<Board>;
  const projects = Array.isArray(saved.projects) ? saved.projects.filter((project): project is Project => Boolean(project?.id && project.name)).map((project) => ({ ...project, goal: project.goal || "" })) : [];
  const tasks = Array.isArray(saved.tasks) ? saved.tasks.filter((task): task is ProjectTask => Boolean(task?.id && task.title && task.projectId)).map((task) => ({ ...task, progress: task.progress || "还没开始", next: task.next || "", status: task.status === "done" || task.status === "paused" ? task.status : "current" })) : [];
  if (!projects.length || !tasks.length) return initialBoard;
  if (projects.length === 1 && projects[0].id === "p1" && tasks.length === 1 && tasks[0].id === "t1" && tasks[0].title === "建立主线看板") return initialBoard;
  const activeTaskId = tasks.some((task) => task.id === saved.activeTaskId) ? saved.activeTaskId! : tasks[0].id;
  const activeProjectId = projects.some((project) => project.id === saved.activeProjectId) ? saved.activeProjectId! : tasks.find((task) => task.id === activeTaskId)!.projectId;
  return { projects, tasks, activeTaskId, activeProjectId };
}

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
    let restored = initialBoard;
    if (saved) {
      try {
        restored = restoreBoard(JSON.parse(saved));
      } catch {}
    }
    const frame = window.requestAnimationFrame(() => {
      setBoard(restored);
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
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
    setBoard((old) => {
      const tasks = old.tasks.filter((task): task is ProjectTask => Boolean(task));
      const parent = tasks.find((task) => task.id === parentId);
      if (!parent) return old;
      const updatedTasks = tasks.map((task) => task.id === taskId ? { ...task, status: "done" } : task.id === parent.id ? { ...task, status: "current" } : task);
      return {
        ...old,
        activeTaskId: parent.id,
        activeProjectId: parent.projectId,
        tasks: updatedTasks,
      };
    });
  }

  function deleteBranch(taskId: string) {
    const task = board.tasks.find((item) => item.id === taskId);
    if (!task || !window.confirm(`删除「${task.title}」和它的所有下级任务？`)) return;
    setBoard((old) => {
      const deletedIds = new Set([taskId]);
      let foundChild = true;
      while (foundChild) {
        foundChild = false;
        old.tasks.forEach((item) => {
          if (item.parentId && deletedIds.has(item.parentId) && !deletedIds.has(item.id)) {
            deletedIds.add(item.id);
            foundChild = true;
          }
        });
      }
      const tasks = old.tasks.filter((item) => !deletedIds.has(item.id));
      const parent = tasks.find((item) => item.id === task.parentId);
      const activeTaskId = deletedIds.has(old.activeTaskId) ? parent?.id ?? tasks[0]?.id : old.activeTaskId;
      return { ...old, tasks, activeTaskId, activeProjectId: parent?.projectId ?? old.activeProjectId };
    });
  }

  function clearBoard() {
    if (!window.confirm("清空全部项目和任务？此操作无法恢复。")) return;
    setCollapsedIds([]);
    setShowBranch(false);
    setShowProject(false);
    setBoard(initialBoard);
  }

  function createFirstTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = String(new FormData(event.currentTarget).get("title") || "").trim();
    if (!title) return;
    const projectId = id();
    const firstTask: ProjectTask = { id: id(), projectId, title, progress: "还没开始", next: "", status: "current" };
    setBoard({
      projects: [{ id: projectId, name: "我的主线", goal: "" }],
      tasks: [firstTask],
      activeProjectId: projectId,
      activeTaskId: firstTask.id,
    });
  }

  function updateCurrent(field: "progress" | "next", value: string) {
    setBoard((old) => ({
      ...old,
      tasks: old.tasks.map((task) => task.id === old.activeTaskId ? { ...task, [field]: value } : task),
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
      progress: "还没开始",
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
    const firstTask = { id: id(), projectId, title: String(form.get("task") || "").trim() || "确定第一步", progress: "刚刚开始", next: "写下现在要做的第一步", status: "current" as const };
    setBoard((old) => ({ ...old, projects: [...old.projects, newProject], tasks: [...old.tasks.map((task) => task.status === "current" ? { ...task, status: "paused" as const } : task), firstTask], activeProjectId: projectId, activeTaskId: firstTask.id }));
    setShowProject(false);
  }

  if (!ready) return null;

  if (!current) {
    return (
      <main className="setup">
        <section className="setup-card">
          <p className="eyebrow">主线看板</p>
          <h1>先写下你正在做的事</h1>
          <form onSubmit={createFirstTask}>
            <label>这件事叫什么？<input name="title" autoFocus placeholder="例如：准备项目书" /></label>
            <button className="primary-button" type="submit">开始</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main>
      <header className="topbar">
        <div><p className="eyebrow">主线看板</p><h1>你现在在这里</h1></div>
        <div className="project-actions"><button className="text-button" onClick={copyMarkdown}>{copied ? "已复制" : "复制 Markdown"}</button><button className="text-button" onClick={downloadMarkdown}>下载 .md</button><select aria-label="切换项目" value={project.id} onChange={(e) => switchProject(e.target.value)}>{board.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="text-button" onClick={() => setShowProject(true)}>+ 新项目</button><button className="text-button danger-button" onClick={clearBoard}>清空记录</button></div>
      </header>

      <section className="orientation" aria-label="当前位置">
        <div><span>项目</span><strong>{project.name}</strong></div>
        <div><span>要去哪里</span><strong>{project.goal || "写下这个项目最终想完成什么"}</strong></div>
      </section>

      <section className="current-card">
        <p className="eyebrow">{current.parentId ? "这件事来自上一条线" : "当前任务 · 只保留一个"}</p>
        <h2>{current.title}</h2>
        <label>我做到哪里了<textarea value={current.progress} onChange={(e) => updateCurrent("progress", e.target.value)} /></label>
        <label className="next">我现在只做这一步<textarea value={current.next} onChange={(e) => updateCurrent("next", e.target.value)} /></label>
        {current.parentId && parentTask && <button type="button" className="return-button" onClick={() => finishAndReturn(current.id, parentTask.id)}>完成并回到「{parentTask.title}」</button>}
        {current.parentId && <button type="button" className="delete-current-button" onClick={() => deleteBranch(current.id)}>删除这条岔路</button>}
      </section>

      <section className="path" aria-label="任务路线">
        <p className="eyebrow">你的路线</p>
        <p className="route-note">每件小事都能沿着“来自”往上追；点 − 可收起一整支路线。</p>
        {routeRoots.length > 0 && <ul className="route-tree">{routeRoots.map((task) => <RouteTree key={task.id} task={task} tasks={projectTasks} currentId={current.id} collapsedIds={collapsedIds} onSelect={setCurrent} onToggle={toggleCollapsed} />)}</ul>}
      </section>

      <section className="branches">
        <div className="section-heading"><div><p className="eyebrow">从这里长出的任务</p><h2>它们都记得自己来自哪里</h2></div><button className="outline-button" onClick={() => setShowBranch(true)}>+ 新任务</button></div>
        {branches.length === 0 ? <p className="empty">暂时没有从这里长出的任务。</p> : (
          <div className="branch-list">{branches.map((branch) => <article className="branch" key={branch.id}><div><p>{branch.title}</p><small>{branch.next}</small></div><div className="branch-actions"><button onClick={() => setCurrent(branch.id)}>去处理</button><button className="danger-button" onClick={() => deleteBranch(branch.id)}>删除</button></div></article>)}</div>
        )}
      </section>

      {showBranch && <dialog open className="dialog"><form method="dialog" onSubmit={addBranch}><div className="section-heading"><h2>从「{current.title}」长出新任务</h2><button type="button" className="close" onClick={() => setShowBranch(false)}>×</button></div><label>这件事叫什么<input name="title" autoFocus placeholder="例如：整理另一个项目的资料" /></label><button className="primary-button" type="submit">记下来源关系</button></form></dialog>}
      {showProject && <dialog open className="dialog"><form method="dialog" onSubmit={addProject}><div className="section-heading"><h2>新项目</h2><button type="button" className="close" onClick={() => setShowProject(false)}>×</button></div><label>项目名称<input name="name" autoFocus placeholder="例如：旅行计划" /></label><label>最终想完成什么<input name="goal" placeholder="例如：确定路线并订好行程" /></label><label>这个项目的第一步<input name="task" placeholder="例如：列出行程约束" /></label><button className="primary-button" type="submit">建立项目并进入</button></form></dialog>}
    </main>
  );
}
