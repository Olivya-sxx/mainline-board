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
  projects: [{ id: "p1", name: "我的总线", goal: "让每件正在做的事都有清楚的下一步" }],
  tasks: [
    {
      id: "t1",
      title: "建立主线看板",
      progress: "先把第一版用起来",
      next: "把你真实正在做的一件事写进来",
      status: "current", projectId: "p1",
    },
  ],
  activeTaskId: "t1", activeProjectId: "p1",
};

const storageKey = "mainline-board-v1";

function id() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Home() {
  const [board, setBoard] = useState<Board>(initialBoard);
  const [ready, setReady] = useState(false);
  const [showBranch, setShowBranch] = useState(false);
  const [showProject, setShowProject] = useState(false);

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

  function setCurrent(taskId: string) {
    setBoard((old) => ({
      ...old,
      activeTaskId: taskId,
      tasks: old.tasks.map((task) => ({ ...task, status: task.id === taskId ? "current" : task.status === "current" ? "paused" : task.status })),
    }));
  }

  function switchProject(projectId: string) {
    const task = board.tasks.find((item) => item.projectId === projectId && item.status === "current") ?? board.tasks.find((item) => item.projectId === projectId);
    if (!task) return;
    setBoard((old) => ({ ...old, activeProjectId: projectId, activeTaskId: task.id }));
  }

  function updateCurrent(field: "progress" | "next", value: string) {
    setBoard((old) => ({
      ...old,
      tasks: old.tasks.map((task) => task.id === old.activeTaskId ? { ...task, [field]: value } : task),
    }));
  }

  function addBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    if (!title || !current) return;
    const task: Task & { projectId: string } = {
      id: id(), title, parentId: current.id, status: "paused",
      projectId: board.activeProjectId,
      progress: String(form.get("progress") || "还没开始").trim(),
      next: String(form.get("next") || "决定何时继续").trim(),
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

  if (!ready || !current) return null;

  return (
    <main>
      <header className="topbar">
        <div><p className="eyebrow">主线看板</p><h1>你现在在这里</h1></div>
        <div className="project-actions"><select aria-label="切换项目" value={project.id} onChange={(e) => switchProject(e.target.value)}>{board.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="text-button" onClick={() => setShowProject(true)}>+ 新项目</button></div>
      </header>

      <section className="orientation" aria-label="当前位置">
        <div><span>项目</span><strong>{project.name}</strong></div>
        <div><span>要去哪里</span><strong>{project.goal || "写下这个项目最终想完成什么"}</strong></div>
      </section>

      <section className="current-card">
        <p className="eyebrow">当前任务 · 只保留一个</p>
        <h2>{current.title}</h2>
        <label>我做到哪里了<textarea value={current.progress} onChange={(e) => updateCurrent("progress", e.target.value)} /></label>
        <label className="next">我现在只做这一步<textarea value={current.next} onChange={(e) => updateCurrent("next", e.target.value)} /></label>
      </section>

      <section className="path" aria-label="任务路线">
        <p className="eyebrow">你的路线</p>
        <div className="line"><span className="dot done" /><span /><span className="dot here" /><span /><span className="dot" /></div>
        <div className="path-labels"><span>开始</span><span>现在</span><span>完成</span></div>
      </section>

      <section className="branches">
        <div className="section-heading"><div><p className="eyebrow">临时岔路</p><h2>从这里离开，也能回到这里</h2></div><button className="outline-button" onClick={() => setShowBranch(true)}>+ 记下岔路</button></div>
        {branches.length === 0 ? <p className="empty">暂时没有岔路。想到别的事时记在这里，主线不会丢。</p> : (
          <div className="branch-list">{branches.map((branch) => <article className="branch" key={branch.id}><div><p>{branch.title}</p><small>{branch.next}</small></div><button onClick={() => setCurrent(branch.id)}>去处理</button></article>)}</div>
        )}
      </section>

      {showBranch && <dialog open className="dialog"><form method="dialog" onSubmit={addBranch}><div className="section-heading"><h2>记下岔路</h2><button type="button" className="close" onClick={() => setShowBranch(false)}>×</button></div><label>突然想到什么<input name="title" autoFocus placeholder="例如：整理另一个项目的资料" /></label><label>它现在做到哪里<input name="progress" placeholder="例如：只有一个念头" /></label><label>下次从哪一步继续<input name="next" placeholder="例如：列出要整理的文件" /></label><button className="primary-button" type="submit">挂到当前任务上</button></form></dialog>}
      {showProject && <dialog open className="dialog"><form method="dialog" onSubmit={addProject}><div className="section-heading"><h2>新项目</h2><button type="button" className="close" onClick={() => setShowProject(false)}>×</button></div><label>项目名称<input name="name" autoFocus placeholder="例如：旅行计划" /></label><label>最终想完成什么<input name="goal" placeholder="例如：确定路线并订好行程" /></label><label>这个项目的第一步<input name="task" placeholder="例如：列出行程约束" /></label><button className="primary-button" type="submit">建立项目并进入</button></form></dialog>}
    </main>
  );
}
