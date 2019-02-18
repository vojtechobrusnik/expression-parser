var parser = (function() {

	var parser = {};


	var TokenType = {
		BRACKET: {
			LEFT: '(',
			RIGHT: ')'
		},
		AND: '&',
		OR: '|',
		ID: '_id_'
	};

	TokenType.guess = function (data) {
		if ((Object.values(TokenType).indexOf(data) !== -1)
			|| (Object.values(TokenType.BRACKET).indexOf(data) !== -1)
		) {
			return data;
		}

		return TokenType.ID;
	};

	function Token(data) {
		this.data = data;
		this.type = TokenType.guess(data);
	}


	var MarkType = {
		END: '_end_',
		RULE: '_rule_'
	};

	function Mark(type) {
		this.type = type;
	}


	function Table() {
		this.map = [
			TokenType.AND, TokenType.OR, TokenType.BRACKET.LEFT, TokenType.BRACKET.RIGHT, TokenType.ID, MarkType.END
		];
		this.table = [
			['>', '>', '<', '>', '<', '>'],
			['>', '>', '<', '>', '<', '>'],
			['<', '<', '<', '=', '<', '' ],
			['>', '>', '' , '>', '' , '>'],
			['>', '>', '' , '>', '' , '>'],
			['<', '<', '<', '' , '<', '' ],
		];
	}

	Table.prototype.read = function (stack, input) {
		var map = function (item) {
			return ((item instanceof Token) || (item instanceof Mark)) ? item.type : '';
		};

		var row = this.map.indexOf(map(stack));
		var column = this.map.indexOf(map(input));
		var cell;

		if ((row === -1) || (column === -1)) {
			return '';
		}

		try {
			cell = this.table[row][column];
			return cell;
		} catch (e) {
			return '';
		}
	};


	function Rule(items, translation) {
		if (!(items instanceof Array)) {
			throw '\'items\' should be an instance of Array.';
		}

		if (translation && !(translation instanceof Array)) {
			throw '\'translation\' should be an instance of Array.';
		}

		this.items = [];
		this.translation = translation || [];

		for (var i = 0; i < items.length; i++) {
			if ((items[i] instanceof Token) || (items[i] instanceof Rule)) {
				this.items.push(items[i]);
			} else {
				this.items.push(new Token(items[i]));
			}
		}
	}

	Rule.prototype.export = function () {
		var output = [];

		for (var i = 0; i < this.translation.length; i++) {
			var j = this.translation[i];

			if (this.items[j] instanceof Token) {
				output.push(this.items[j].data);
			} else if (this.items[j] instanceof Rule) {
				output = output.concat(this.items[j].export());
			}
		}

		return output;
	};

	Rule.prototype.match = function (rule) {
		if (!(rule instanceof Rule)) {
			return false;
		}

		if (this.items.length !== rule.items.length) {
			return false;
		}

		for (var i = 0; i < this.items.length; i++) {
			if ((this.items[i] instanceof Token)
				&& (rule.items[i] instanceof Token)
				&& (this.items[i].type !== rule.items[i].type)
			) {
				return false;
			} else if ((this.items[i] instanceof Token)
				&& (rule.items[i] instanceof Rule)
				&& (this.items[i].type !== TokenType.ID)
			) {
				return false;
			} else if ((this.items[i] instanceof Rule)
				&& (rule.items[i] instanceof Token)
				&& (rule.items[i].type !== TokenType.ID)
			) {
				return false;
			} else if ((this.items[i] instanceof Rule)
				&& (rule.items[i] instanceof Rule)
				&& !this.items[i].match(rule.items[i])
			) {
				return false;
			}
		}

		return true;
	};


	function RuleSet() {
		this.rules = [];
	}

	RuleSet.prototype.add = function (rule) {
		if (!(rule instanceof Rule)) {
			throw '\'rule\' should be an instance of Rule.';
		}

		this.rules.push(rule);

		return this;
	};

	RuleSet.prototype.find = function (rule) {
		if (!(rule instanceof Rule)) {
			throw '\'rule\' should be an instance of Rule.';
		}

		for (var i = 0; i < this.rules.length; i++) {
			if (this.rules[i].match(rule)) {
				return this.rules[i];
			}
		}

		return null;
	};


	function Stack() {
		this.stack = [];
	}

	Stack.prototype.isEmpty = function () {
		return this.stack.length < 1;
	};

	Stack.prototype.push = function (item) {
		this.stack.push(item);
	};

	Stack.prototype.pop = function () {
		if (this.isEmpty()) {
			return null;
		}

		return this.stack.pop();
	};

	Stack.prototype.readTerminal = function () {
		if (this.isEmpty()) {
			return null;
		}

		for (var i = this.stack.length - 1; i >= 0; i--) {
			if (this.stack[i] instanceof Token) {
				return this.stack[i];
			} else if ((this.stack[i] instanceof Mark)
				&& (this.stack[i].type === MarkType.END)
			) {
				return this.stack[i];
			}
		}

		return null;
	};

	Stack.prototype.pushRuleMark = function () {
		if (this.isEmpty()) {
			return;
		}

		var mark = new Mark(MarkType.RULE);

		for (var i = this.stack.length - 1; i >= 0; i--) {
			if (this.stack[i] instanceof Token) {
				this.stack.splice(i + 1, 0, mark);
				return;
			} else if ((this.stack[i] instanceof Mark)
				&& (this.stack[i].type === MarkType.END)
			) {
				this.stack.splice(i + 1, 0, mark);
				return;
			}
		}
	};

	Stack.prototype.readRule = function () {
		if (this.isEmpty()) {
			return null;
		}

		for (var i = this.stack.length - 1; i >= 0; i--) {
			if ((this.stack[i] instanceof Mark)
				&& (this.stack[i].type === MarkType.RULE)
			) {
				var items = this.stack.slice(i + 1);
				return new Rule(items);
			}
		}

		return null;
	};

	Stack.prototype.replaceRule = function (rule) {
		if (!(rule instanceof Rule)) {
			throw '\'rule\' should be an instance of Rule.';
		}

		if (this.isEmpty()) {
			return;
		}

		for (var i = this.stack.length - 1; i >= 0; i--) {
			if ((this.stack[i] instanceof Mark)
				&& (this.stack[i].type === MarkType.RULE)
			) {
				this.stack.splice(i, this.stack.length, rule);
				return;
			}
		}
	};


	var rules = new RuleSet();

	rules.add(new Rule([TokenType.ID, TokenType.AND, TokenType.ID], [0, 2, 1]))
		 .add(new Rule([TokenType.ID, TokenType.OR, TokenType.ID], [0, 2, 1]))
		 .add(new Rule([TokenType.BRACKET.LEFT, TokenType.ID, TokenType.BRACKET.RIGHT], [1]))
		 .add(new Rule([TokenType.ID], [0]));


	var stack = new Stack();

	stack.push(new Mark(MarkType.END));


	var table = new Table();


	function analyze(input) {
		if (!(input instanceof Array)) {
			throw '\'input\' should be an instance of Array.';
		}

		var s, i, t;
		var rule, pattern;

		i = input.shift();

		while(1) {
			s = stack.readTerminal();
			t = table.read(s, i);

			if (((s instanceof Mark) && (s.type === MarkType.END))
				&& ((i instanceof Mark) && (i.type === MarkType.END))
			) {
				break;
			}

			if (t === '=') {
				stack.push(i);
				i = input.shift();
			} else if (t === '<') {
				stack.pushRuleMark();
				stack.push(i);
				i = input.shift();
			} else if (t === '>') {
				rule = stack.readRule();
				pattern = rules.find(rule);

				if ((rule instanceof Rule) && (pattern instanceof Rule)) {
					rule.translation = pattern.translation;
					stack.replaceRule(rule);
				} else {
					throw 'Syntax Error.';
				}
			} else {
				throw 'Syntax Error.';
			}
		}

		rule = stack.pop();

		return (rule instanceof Rule) ? rule : null;
	}


	parser.run = function (expression) {
		if (!(expression instanceof Array)) {
			throw '\'expression\' should be an instance of Array.';
		}

		var input = [];
		var rule;

		for (var i = 0; i < expression.length; i++) {
			input.push(new Token(expression[i]));
		}

		input.push(new Mark(MarkType.END));

		rule = analyze(input);

		if (rule === null) {
			throw 'Parser Error.'
		}

		return rule.export();
	};


	return parser;

})();
