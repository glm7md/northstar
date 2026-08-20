'use strict';

const asyncHandler = require('../utils/asyncHandler');
const gradebookService = require('../services/gradebook.service');

const getGradesByYear = asyncHandler(async (req, res) => {
  const year = req.query.year || null;
  const students = await gradebookService.getGradesByYear(year);
  res.json({ ok: true, students });
});

module.exports = { getGradesByYear };
