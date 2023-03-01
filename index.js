const express = require("express");
const mongoose = require("mongoose");

const app = express();
const cors = require("cors");
require("dotenv").config();

const User = require("./models/user");
const Exercise = require("./models/exercise");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGO_URI, {
  useUnifiedTopology: true,
  useNewUrlParser: true,
});

app.use(cors());

app.use(express.static("public"));

app.use((req, res, next) => {
  console.log(
    "method: " + req.method + "  |  path: " + req.path + "  |  IP - " + req.ip
  );
  next();
});

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

// /api/users/
// GET: Show the contents of the User model
// POST: Store user into User model
app
  .route("/api/users")
  .get(async (req, res) => {
    try {
      const user = await User.find({});
      res.json(user);
      console.log(user);
    } catch (err) {
      console.log(err);
    }
  })
  .post(async (req, res) => {
    const potentialUsername = req.body.username;
    console.log("potential username:", potentialUsername);

    let user = {};
    try {
      user = await User.findOne({ username: potentialUsername });
      console.log(user);
    } catch (err) {
      console.log(err);
    }

    if (!user) {
      const newUser = new User({
        username: potentialUsername,
      });

      newUser
        .save()
        .then((data) => {
          const reducedData = {
            username: data.username,
            _id: data._id,
          };
          res.json(reducedData);
        })
        .catch((err) => {
          console.log(err);
        });
    } else {
      // If username is already stored, send a message to the user
      res.send(`Username ${potentialUsername} already exists.`);
      console.log(`Username ${potentialUsername} already exists.`);
    }
  });

// PATH /api/users/:_id/exercises
// POST: Store new exercise in the Exercise model
app.post("/api/users/:_id/exercises", async (req, res) => {
  // Get data from form
  const userID = req.body[":_id"] || req.params._id;
  const descriptionEntered = req.body.description;
  const durationEntered = req.body.duration;
  const dateEntered = req.body.date;

  // Print statement for debugging
  console.log(userID, descriptionEntered, durationEntered, dateEntered);

  // Make sure the user has entered in an id, a description, and a duration
  // Set the date entered to now if the date is not entered
  if (!userID) {
    res.json("Path `userID` is required.");
    return;
  }
  if (!descriptionEntered) {
    res.json("Path `description` is required.");
    return;
  }
  if (!durationEntered) {
    res.json("Path `duration` is required.");
    return;
  }

  let user = {};
  try {
    user = await User.findOne({ _id: userID });
    console.log(user);
  } catch (err) {
    res.json("Invalid userID");
    console.log(err);
  }

  if (!user) {
    res.json("Unknown userID");
    return;
  } else {
    console.log(user);
    const usernameMatch = user.username;

    // Create an Exercise object
    const newExercise = new Exercise({
      username: usernameMatch,
      description: descriptionEntered,
      duration: durationEntered,
    });

    // Set the date of the Exercise object if the date was entered
    if (dateEntered) {
      newExercise.date = dateEntered;
    }

    // // Save the exercise
    // newExercise.save((error, data) => {
    //   if (error) return console.log(error);

    //   console.log(data);

    //   // Create JSON object to be sent to the response
    //   const exerciseObject = {
    //     _id: userID,
    //     username: data.username,
    //     date: data.date.toDateString(),
    //     duration: data.duration,
    //     description: data.description,
    //   };

    //   // Send JSON object to the response
    //   res.json(exerciseObject);
    // });

    newExercise
      .save()
      .then((data) => {
        const exerciseObject = {
          _id: userID,
          username: data.username,
          date: data.date.toDateString(),
          duration: data.duration,
          description: data.description,
        };
        res.json(exerciseObject);
      })
      .catch((err) => {
        console.log(err);
      });
  }
}); //app post end

// PATH /api/users/:_id/logs?[from][&to][&limit]
app.get("/api/users/:_id/logs", async (req, res) => {
  const id = req.body["_id"] || req.params._id;
  var fromDate = req.query.from;
  var toDate = req.query.to;
  var limit = req.query.limit;

  console.log(id, fromDate, toDate, limit);

  // Validate the query parameters
  if (fromDate) {
    fromDate = new Date(fromDate);
    if (fromDate == "Invalid Date") {
      res.json("Invalid Date Entered");
      return;
    }
  }

  if (toDate) {
    toDate = new Date(toDate);
    if (toDate == "Invalid Date") {
      res.json("Invalid Date Entered");
      return;
    }
  }

  if (limit) {
    limit = new Number(limit);
    if (isNaN(limit)) {
      res.json("Invalid Limit Entered");
      return;
    }
  }

  let user = {};
  try {
    user = await User.findOne({ _id: id });
    console.log(user);
  } catch (err) {
    res.json("Invalid userID");
    console.log(err);
  }

  if (!user) {
    res.json("Invalid UserID");
  } else {
    // Initialize the object to be returned
    const usernameFound = user.username;
    var objToReturn = { _id: id, username: usernameFound };

    // Initialize filters for the count() and find() methods
    var findFilter = { username: usernameFound };
    var dateFilter = {};

    // Add to and from keys to the object if available
    // Add date limits to the date filter to be used in the find() method on the Exercise model
    if (fromDate) {
      objToReturn["from"] = fromDate.toDateString();
      dateFilter["$gte"] = fromDate;
      if (toDate) {
        objToReturn["to"] = toDate.toDateString();
        dateFilter["$lt"] = toDate;
      } else {
        dateFilter["$lt"] = Date.now();
      }
    }

    if (toDate) {
      objToReturn["to"] = toDate.toDateString();
      dateFilter["$lt"] = toDate;
      dateFilter["$gte"] = new Date("1960-01-01");
    }

    // Add dateFilter to findFilter if either date is provided
    if (toDate || fromDate) {
      findFilter.date = dateFilter;
    }

    // console.log(findFilter);
    // console.log(dateFilter);

    // Add the count entered or find the count between dates
    let exerciseCount1 = {};
    try {
      exerciseCount1 = await Exercise.count(findFilter);
      console.log(user);
    } catch (err) {
      res.json("Invalid userID");
      console.log(err);
    }

    // Add the count key
    var count = exerciseCount1;
    if (limit && limit < count) {
      count = limit;
    }
    objToReturn["count"] = count;

    // Find the exercises and add a log key linked to an array of exercises
    let foundEx = {};
    try {
      foundEx = await Exercise.find(findFilter);
      console.log(foundEx);
    } catch (err) {
      res.json("Invalid userID");
      console.log(err);
    }

    // console.log(data);

    var logArray = [];
    var objectSubset = {};
    var count = 0;

    //Iterate through data array for description, duration, and date keys
    foundEx.forEach(function (val) {
      count += 1;
      if (!limit || count <= limit) {
        objectSubset = {};
        objectSubset.description = val.description;
        objectSubset.duration = val.duration;
        objectSubset.date = val.date.toDateString();
        console.log(objectSubset);
        logArray.push(objectSubset);
      }
    });

    // Add the log array of objects to the object to return
    objToReturn["log"] = logArray;

    // Return the completed JSON object
    res.json(objToReturn);
  }
});

// ----------------
// ADDITIONAL PATHS (not required for the FreeCodeCamp project)

// PATH /api/exercises/
// Display all of the exercises in the Mongo DB model titled Exercise
app.get("/api/exercises", (req, res) => {
  Exercise.find({}, (error, data) => {
    if (error) return console.log(error);
    res.json(data);
  });
});

app.post("/register", function (req, res) {
  const newUser = new User({
    email: req.body.email,
    password: req.body.password,
  });

  newUser
    .save()
    .then(() => {
      res.render("secrets");
    })
    .catch((err) => {
      console.log(err);
    });
});

// Listen on the proper port to connect to the server
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
