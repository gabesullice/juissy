export default class Filter {

  constructor(f) {
    this.conditions = f(Conditions, (key) => (parameters) => parameters[key]);
  }

  compile(parameters) {
    const id = function* () {
      var counter = 1;
      while (true) {
        yield counter++;
      }
    }();

    const compiler = (acc, item, _, parentID = null) => {
      const currentID = id.next().value;
      const prefix = acc.length ? `${acc}&` : '';
      if (item.members) {
        const root = `filter[${currentID}][group]`;
        const self = parentID
          ? `${root}[conjunction]=${item.conjunction}&${root}[memberOf]=${parentID}`
          : `${root}[conjunction]=${item.conjunction}`;
        return `${prefix}${item.members.reduce((acc, item, _) => compiler(acc, item, _, currentID), self)}`;
      }
      else {
        const root = `filter[${currentID}][condition]`;
        var self = '';
        self += `${root}[path]=${item.path}`;
        // @todo expand for multivalue operators an null/not null
        self += `&${root}[value]=${typeof item.value === "function" ? item.value(parameters) : item.value}`;
        self += `&${root}[operator]=${item.operator}`;
        return parentID
          ? `${prefix}${self}&${root}[memberOf]=${parentID}`
          : `${prefix}${self}`;
      }
    };

    return compiler('', this.conditions);
  }

}

const Groups = {

  and: (...members) => {
    return Groups.group(members, 'AND');
  },

  or: (...members) => {
    return Groups.group(members, 'OR');
  },

  group: (members, conjunction) => {
    return {
      conjunction,
      members,
    }
  },

}

const Conditions = function (f, v) {
  return Conditions.eq(f, v);
}

Conditions.and = Groups.and;

Conditions.or = Groups.or;

Conditions.eq = (f, v) => {
  return Conditions.condition(f, v, '=');
}

Conditions.notEq = (f, v) => {
  return Conditions.condition(f, v, '<>');
}

Conditions.gt = (f, v) => {
  return Conditions.condition(f, v, '>');
}

Conditions.gtEq = (f, v) => {
  return Conditions.condition(f, v, '>=');
}

Conditions.lt = (f, v) => {
  return Conditions.condition(f, v, '<');
}

Conditions.ltEq = (f, v) => {
  return Conditions.condition(f, v, '<=');
}

Conditions.startsWith = (f, v) => {
  return Conditions.condition(f, v, 'STARTS_WITH');
}

Conditions.contains = (f, v) => {
  return Conditions.condition(f, v, 'CONTAINS');
}

Conditions.endsWith = (f, v) => {
  return Conditions.condition(f, v, 'ENDS_WITH');
}

// @todo add support for: 'IN', 'NOT IN'
// @todo add support for: 'BETWEEN', 'NOT BETWEEN'
// @todo add support for: 'IS NULL', 'IS NOT NULL'

Conditions.condition = (f, v, op) => {
  return {
    path: f,
    value: v,
    operator: encodeURIComponent(op),
  };
}
