const { Op } = require("sequelize");
const db = require("../utils/db");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const get = async (req, res) => {
  const name = req.query.name || "";
  const { count, rows } = await db.task.findAndCountAll({
    limit: req.pagination.limit,
    offset: req.pagination.offset,
    include: [
      {
        model: db.object_task,
        as: "object_task",
        include: [
          {
            model: db.object,
            as: "objects",
            // include: ["object"],
          },
          {
            model: db.standard_task,
            as: "standard_task",
            include: ["standard"],
          },
        ],
      },
      {
        model: db.checklist_task,
        as: "checklist_task",
        include: ["checklists"],
      },
    ],
  });

  res.set("Content-Range", count).send(rows);
};

const getById = async (req, res) => {
  const task = await db.task.findOne({
    where: { id: req.params.id },
    include: [
      {
        model: db.object_task,
        as: "object_task",
        include: [
          {
            model: db.object,
            as: "objects",
            // include: ["object"],
          },
          {
            model: db.standard_task,
            as: "standard_task",
            include: ["standard"],
          },
        ],
      },
      {
        model: db.checklist_task,
        as: "checklist_task",
        include: ["checklists"],
      },
    ],
  });
  if (!task) res.status(404).send("task not found!");
  else res.send(task);
};
const getDetailTaskId = async (req, res) => {
  const task = await db.object_task.findOne({
    where: { id: req.params.id },
    include: [
      {
        model: db.task,
        as: "task",
      },
      {
        model: db.object,
        as: "objects",
        // include: ["object"],
      },
      {
        model: db.standard_task,
        as: "standard_task",
        include: ["standard"],
      },
    ],
  });
  if (!task) res.status(404).send("detail task not found!");
  else res.send(task);
};
const updateProcess = async (req, res) => {
  let originalName = "";
  const { task_id, process_object_task, ...rest } = req.body;
  if (req.files.files) {
    // const filePath = req.files.files.path.slice(6);
    originalName = req.files.files.originalFilename; // Tên file gốc từ FE
    const tempPath = req.files.files.path.slice(6); // Đường dẫn tạm thời
    const targetPath = path.join(__dirname, "../public/files", originalName); // Đường dẫn đích
    const tempPath2 = path.join(__dirname, "../public", tempPath); // Đường dẫn đích

    // Di chuyển file từ thư mục tạm thời sang vị trí lưu trữ với tên gốc
    fs.rename(tempPath2, targetPath, (err) => {
      if (err) {
        console.error(err);
        // return res.status(500).send("Error saving file");
      }
      // res
      //   .status(200)
      //   .send({ message: "File uploaded successfully", fileName: originalName });
    });
  }
  const checklist_task = await db.standard_task.findOne({
    where: { id: req.params.id },
  });
  if (!checklist_task) res.status(404).send("standard_task not found!");
  else {
    await db.standard_task.update(
      {
        ...rest,
        image: req.files.files ? `/files/${originalName}` : null,
        mobile_path: req.body.mobile_path ? req.body.mobile_path : null,
      },
      {
        where: { id: req.params.id },
      }
    );
    await db.object_task.update(
      {
        process: process_object_task,
      },
      {
        where: { id: checklist_task.object_task_id },
      }
    );
    const object_task = await db.object_task.findAll({
      where: { task_id: task_id },
    });

    const object_task_filter = await db.object_task.findAll({
      where: {
        task_id: task_id,
        process: "Đã hoàn thành",
      },
    });
    // console.log(standard_task_filter);

    await db.task.update(
      {
        process: `${object_task_filter.length}/${object_task.length}`,
      },
      { where: { id: task_id } }
    );
    res.send("process standard successfully updated!");
  }
};

const create = async (req, res) => {
  const { list_object, checklist_id, ...rest } = req.body;

  const user = await db.task.findOne({
    where: { name: rest.name },
  });
  const object = await db.object.findAll({
    where: { group_object_id: list_object },
  });

  if (object.length > 0) {
    if (!user) {
      const task = await db.task.create({
        ...rest,
        process: `0/${object.length}`,
      });
      // console.log(rest);
      const { count, rows } = await db.standard.findAndCountAll({
        where: {
          check_list_id: checklist_id,
        },
      });
      // const standard = rows.map((item) => ({
      //   id: uuidv4(),
      //   task_id: task.id,
      //   standard_id: item.id,
      // }));

      // if (standard.length > 0) {

      // }
      if (checklist_id && list_object) {
        await db.checklist_task.create({
          // name:"tung",
          id: uuidv4(),
          task_id: task.id,
          checklist_id: checklist_id,
        });
        const data = object.map((item) => ({
          id: uuidv4(),
          object_id: item.id,
          task_id: task.id,
          process: "Chưa hoàn thành",
        }));
        // console.log(data);

        await db.object_task.bulkCreate(data);

        await Promise.all(
          data.map(async (item) => {
            const standard = rows.map((it) => ({
              id: uuidv4(),
              object_task_id: item.id,
              standard_id: it.id,
              process: "",
              image: "",
            }));
            await db.standard_task.bulkCreate(standard);
          })
        );
      }
      res.send(task);
    } else {
      res.status(422).send("Tên nhiệm vụ đã tồn tại");
    }
  } else {
    res.status(422).send("Vui lòng thêm mới đối tượng vào nhóm đối tượng");
  }
};

const getAllData = async (req, res) => {
  const task = await db.task.findAll();
  const object = await db.object.findAll();
  const group_object = await db.group_object.findAll();
  const check_list = await db.check_list.findAll();
  const standard = await db.standard.findAll();
  const checklist_task = await db.checklist_task.findAll();
  const standard_task = await db.standard_task.findAll();
  const object_task = await db.object_task.findAll();
  const users = await db.user.findAll();
  res.send({
    task,
    object,
    check_list,
    standard,
    checklist_task,
    standard_task,
    object_task,
    users,
    group_object,
  });
};

const update = async (req, res) => {
  const { list_object, checklist_id, ...rest } = req.body;
  const task = await db.task.findOne({
    where: { id: req.params.id },
  });
  console.log("name", res.body);

  const checkname = await db.task.findOne({
    where: { name: rest.name },
  });
  if (true) {
    if (!task) res.status(404).send("task not found!");
    else {
      await db.task.update(
        {
          ...req.body,
        },
        {
          where: { id: req.params.id },
        }
      );
      res.send("task successfully updated!");
    }
  } else res.status(200).send("Tên nhiệm vụ đã tồn tại");
};

const deleteById = async (req, res) => {
  const task = await db.task.findOne({
    where: { id: req.params.id },
  });

  if (!task) res.status(404).send("task not found!");
  else {
    const object_task = await db.object_task.findAll({
      where: { task_id: req.params.id },
    });
    await Promise.all(
      object_task.map((item) => {
        return db.standard_task.destroy({
          where: { object_task_id: item.id },
        });
      })
    );
    await db.object_task.destroy({
      where: { task_id: req.params.id },
    });
    await db.checklist_task.destroy({
      where: { task_id: req.params.id },
    });
    await db.task.destroy({
      where: { id: req.params.id },
    });
    res.send("task successfully deleted!");
  }
};
const uploadFilePdf = async (req, res) => {
  const originalName = req.files.files.originalFilename; // Tên file gốc từ FE
  const tempPath = req.files.files.path.slice(6); // Đường dẫn tạm thời
  const targetPath = path.join(__dirname, "../public/files", originalName); // Đường dẫn đích
  const tempPath2 = path.join(__dirname, "../public", tempPath); // Đường dẫn đích

  fs.rename(tempPath2, targetPath, (err) => {
    if (err) {
      console.error(err);
      // return res.status(500).send("Error saving file");
    }
    // res
    //   .status(200)
    //   .send({ message: "File uploaded successfully", fileName: originalName });
  });
  const task = await db.object_task.findOne({
    where: { id: req.params.id },
  });
  if (task) {
    await db.object_task.update(
      {
        // ...task,s
        ...req.body,
        pdf_path: `/files/${originalName}`,
      },
      {
        where: { id: req.params.id },
      }
    );
    res.send("upload file successfully!");
  } else {
    res.status(404).send("task not found");
  }
};
module.exports = {
  get,
  getById,
  create,
  update,
  deleteById,
  updateProcess,
  getAllData,
  getDetailTaskId,
  uploadFilePdf,
};
