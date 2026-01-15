CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
  title,
  summary,
  content,
  content=items,
  content_rowid=rowid
);

-- Triggers for FTS5
CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
  INSERT INTO items_fts(rowid, title, summary, content)
  VALUES (new.rowid, new.title, new.summary, new.content);
END;

CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
  DELETE FROM items_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE OF title, summary, content ON items BEGIN
  UPDATE items_fts 
  SET title = new.title, summary = new.summary, content = new.content
  WHERE rowid = new.rowid;
END;

-- Populate FTS index
INSERT INTO items_fts(rowid, title, summary, content)
SELECT rowid, title, summary, content FROM items
WHERE rowid NOT IN (SELECT rowid FROM items_fts);
