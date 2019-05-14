const mongoose = require('mongoose');

const Node = new mongoose.Schema({
  rule: String,
  component: String
});
Node.add({
  childrens: [Node]
});

const Component = new mongoose.Schema({
  id: String,
  name: String,
  type: String
})

const Tree = new mongoose.Schema({
  name: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user'
  },
  time: Date,
  components: [Component],
  tree: [Node],
  value: Number
}, {
  timestamps: true
});
Tree.index({"createdAt": 1});

module.exports = mongoose.model('tree', Tree);