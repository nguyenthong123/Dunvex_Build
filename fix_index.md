The error `[code=failed-precondition]: The query requires an index.` is a standard Firebase message.
It happens because some pages (like the "Thu Nợ" / Debts page) need to filter data by `ownerId` AND sort it by `createdAt` at the same time to get the newest records. Firebase requires a "Composite Index" for this to be fast.
