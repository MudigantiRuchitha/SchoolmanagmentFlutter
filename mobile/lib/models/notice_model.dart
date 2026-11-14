class SchoolNotice {
  final int id;
  final String title;
  final String content;
  final String? targetType; // all, staff, class, branch
  final String? branchName;
  final String? className;
  final bool isImportant;
  final String? createdAt;
  final String? authorName;

  SchoolNotice({
    required this.id,
    required this.title,
    required this.content,
    this.targetType,
    this.branchName,
    this.className,
    required this.isImportant,
    this.createdAt,
    this.authorName,
  });

  factory SchoolNotice.fromJson(Map<String, dynamic> json) {
    return SchoolNotice(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      title: json['title'] ?? '',
      content: json['content'] ?? json['description'] ?? '',
      targetType: json['target_type'],
      branchName: json['branch_name'],
      className: json['class_name'],
      isImportant: json['is_important'] == true || json['important'] == true,
      createdAt: json['created_at'],
      authorName: json['author_name'] ?? json['created_by_name'],
    );
  }
}

