# Relations point at Records by (type, id), not through a shared record table

Every Record type has its own table, so a Relation stores `(type, id)` at each end in one `relation` table. Tags point at Records the same way. We rejected a shared base `record` table, which would have given every Record one global id. That table would undo the "each type has its own table" constraint and make the file harder to read in DB Browser. The trade-off is that SQLite can't enforce these references with foreign keys. The app must delete a Record's Relations and Tags itself when it deletes the Record.
